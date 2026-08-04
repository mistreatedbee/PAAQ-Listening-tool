package io.paaq.intelligence

import android.app.Activity
import android.app.Application
import android.content.Context
import android.os.Build
import android.os.Bundle
import kotlinx.coroutines.*
import java.text.SimpleDateFormat
import java.util.*

/** Grace period after the app goes to background before a session is
 * considered ended — distinguishes a brief app-switch from the user
 * actually being done. */
private const val BACKGROUND_GRACE_MS = 30_000L

/**
 * PAAQ Intelligence SDK — Android
 *
 * Usage:
 *   class MyApp : Application() {
 *       override fun onCreate() {
 *           super.onCreate()
 *           PAAQ.initialize(this, sdkToken = "sdk_live_...", projectId = "proj_...")
 *       }
 *   }
 */
object PAAQ {

    private var api: PaaqApiClient? = null
    private var sessionId: String? = null
    private var sessionStartedAtMs: Long = 0
    private var sessionEnded = false
    private val queue = mutableListOf<PaaqEvent>()
    private val queueLock = Any()
    private var batchSize = 50
    private var config = PaaqConfig("", "")
    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())
    private var flushJob: Job? = null
    private var heartbeatJob: Job? = null
    private var backgroundGraceJob: Job? = null
    private var activityCallbacks: Application.ActivityLifecycleCallbacks? = null
    private val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }

    /**
     * Initialize the SDK. Call from Application.onCreate().
     */
    fun initialize(
        context: Context,
        sdkToken: String,
        projectId: String,
        environment: String = "production",
        debug: Boolean = false,
    ) {
        config = PaaqConfig(sdkToken, projectId, environment, debug)
        val deviceId = getOrCreateDeviceId(context)
        api = PaaqApiClient(config, deviceId)
        sessionEnded = false

        scope.launch {
            try {
                val result = api!!.sdkInit(collectDeviceMetadata(context))
                sessionId = result.sessionId
                sessionStartedAtMs = System.currentTimeMillis()
                result.batchSize?.let { batchSize = it }
                val flushInterval = result.flushIntervalSeconds ?: config.flushIntervalSeconds
                log("Initialized — session: $sessionId")
                startFlushLoop(flushInterval)
                startHeartbeatLoop(config.heartbeatIntervalSeconds)
                registerLifecycleCallbacks(context)
            } catch (e: Exception) {
                log("Init failed: ${e.message}")
            }
        }
    }

    private fun collectDeviceMetadata(context: Context): PaaqApiClient.DeviceMetadata {
        val appVersion = try {
            context.packageManager.getPackageInfo(context.packageName, 0).versionName
        } catch (_: Exception) { null }
        val metrics = context.resources.displayMetrics
        return PaaqApiClient.DeviceMetadata(
            osVersion = Build.VERSION.RELEASE ?: "",
            deviceModel = Build.MODEL ?: "",
            appVersion = appVersion,
            screenWidth = metrics.widthPixels,
            screenHeight = metrics.heightPixels,
        )
    }

    /**
     * Application.ActivityLifecycleCallbacks is a first-class, app-wide API
     * on Android (unlike iOS, which has no single equivalent) — safe to
     * install automatically for zero-touch screen tracking and real
     * background/foreground detection, no opt-in required.
     */
    private fun registerLifecycleCallbacks(context: Context) {
        val app = context.applicationContext as? Application ?: return
        activityCallbacks?.let { app.unregisterActivityLifecycleCallbacks(it) }

        var startedActivities = 0
        val callbacks = object : Application.ActivityLifecycleCallbacks {
            override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}
            override fun onActivityResumed(activity: Activity) {
                screen(activity.javaClass.simpleName)
                installTouchTracking(activity)
            }
            override fun onActivityStarted(activity: Activity) {
                startedActivities++
                if (startedActivities == 1) {
                    backgroundGraceJob?.cancel()
                }
            }
            override fun onActivityStopped(activity: Activity) {
                startedActivities--
                if (startedActivities <= 0) {
                    backgroundGraceJob?.cancel()
                    backgroundGraceJob = scope.launch {
                        delay(BACKGROUND_GRACE_MS)
                        endSession("completed")
                    }
                }
            }
            override fun onActivityPaused(activity: Activity) {}
            override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
            override fun onActivityDestroyed(activity: Activity) {}
        }
        activityCallbacks = callbacks
        app.registerActivityLifecycleCallbacks(callbacks)
    }

    private fun installTouchTracking(activity: Activity) {
        val window = activity.window ?: return
        val existing = window.callback
        if (existing is PaaqWindowCallbackWrapper) return // already wrapped
        val tracker = PaaqTouchTracker(
            onRageTap = { x, y, count -> track("\$rage_click", mapOf("x" to x, "y" to y, "tapCount" to count)) },
            onDeadTap = { x, y -> track("\$dead_click", mapOf("x" to x, "y" to y)) },
            lastSignalAtMs = { lastSignalAtMs },
        )
        window.callback = PaaqWindowCallbackWrapper(existing, tracker)
    }

    // ── Scroll depth — opt-in, no universal scroll hook exists on Android ──

    private var maxScrollPct = 0
    private val reportedScrollMilestones = mutableSetOf<Int>()

    /** Call from a scroll listener (RecyclerView.OnScrollListener, NestedScrollView.OnScrollChangeListener, etc.) with 0-100. */
    fun trackScrollDepth(pct: Int) {
        if (pct <= maxScrollPct) return
        maxScrollPct = pct
        for (milestone in intArrayOf(25, 50, 75, 100)) {
            if (pct >= milestone && reportedScrollMilestones.add(milestone)) {
                track("\$scroll_depth", mapOf("pct" to milestone))
            }
        }
    }

    /** Call when navigating to a new screen so scroll depth is measured per screen. */
    fun resetScrollTracking() {
        maxScrollPct = 0
        reportedScrollMilestones.clear()
    }

    // ── Form field friction — opt-in, wire into your existing focus/text listeners ──

    private val fieldStartedAtMs = mutableMapOf<String, Long>()
    private val fieldBackspaceCounts = mutableMapOf<String, Int>()

    fun trackFieldFocus(fieldName: String) {
        fieldStartedAtMs[fieldName] = System.currentTimeMillis()
        fieldBackspaceCounts[fieldName] = 0
    }

    fun trackFieldBackspace(fieldName: String) {
        fieldBackspaceCounts[fieldName] = (fieldBackspaceCounts[fieldName] ?: 0) + 1
    }

    fun trackFieldBlur(fieldName: String, formName: String? = null, hadError: Boolean = false, completed: Boolean = false) {
        val startedAt = fieldStartedAtMs.remove(fieldName)
        val backspaces = fieldBackspaceCounts.remove(fieldName) ?: 0
        track("\$form_field", mapOf(
            "fieldName" to fieldName,
            "formName" to (formName ?: ""),
            "timeSpentMs" to (startedAt?.let { System.currentTimeMillis() - it } ?: 0L),
            "backspaceCount" to backspaces,
            "hadError" to hadError,
            "completed" to completed,
        ))
    }

    fun trackFormAbandon(formName: String) {
        track("\$form_abandon", mapOf("formName" to formName))
    }

    private var lastSignalAtMs = 0L

    /** Track a custom event */
    fun track(eventName: String, properties: Map<String, Any> = emptyMap()) {
        lastSignalAtMs = System.currentTimeMillis()
        val event = PaaqEvent(eventName, sessionId, properties, now())
        synchronized(queueLock) { queue.add(event) }
        log("Queued $eventName")
        if (queueSize() >= batchSize) scope.launch { flush() }
    }

    /** Identify the current user */
    fun identify(userId: String, traits: Map<String, Any> = emptyMap()) {
        track("\$identify", traits + ("userId" to userId))
    }

    /** Record a screen view */
    fun screen(name: String) {
        track("\$screen", mapOf("name" to name))
    }

    /** Capture an exception */
    fun captureException(throwable: Throwable, context: Map<String, Any> = emptyMap()) {
        track("\$error", mapOf(
            "error_type" to throwable.javaClass.simpleName,
            "error_message" to (throwable.message ?: ""),
        ) + context)
    }

    /** Flush pending events to the backend */
    suspend fun flush() {
        val batch = synchronized(queueLock) {
            if (queue.isEmpty()) return
            val copy = queue.toList()
            queue.clear()
            copy
        }
        log("Flushing ${batch.size} events")
        api?.flush(batch)
    }

    /** Call from Application.onTerminate() or before process exit */
    fun dispose() {
        flushJob?.cancel()
        heartbeatJob?.cancel()
        backgroundGraceJob?.cancel()
        scope.launch {
            flush()
            endSession("completed")
        }
    }

    /** End the current session because the host app knows the user logged
     * out — the SDK cannot infer this on its own. */
    fun endSessionOnLogout() {
        scope.launch { endSession("logged_out") }
    }

    // Android's ActivityLifecycleCallbacks has no reliable signal for a hard
    // process kill (no equivalent to iOS's willTerminate) — that case is left
    // to session-sweep-cron server-side, which classifies a session that
    // goes silent as 'timed_out'/'abandoned'.
    private suspend fun endSession(outcome: String) {
        val id = sessionId ?: return
        if (sessionEnded) return
        sessionEnded = true
        val durationSeconds = if (sessionStartedAtMs > 0) {
            (System.currentTimeMillis() - sessionStartedAtMs) / 1000
        } else 0
        api?.endSession(id, durationSeconds, outcome)
    }

    private fun startFlushLoop(intervalSeconds: Long) {
        flushJob?.cancel()
        flushJob = scope.launch {
            while (isActive) {
                delay(intervalSeconds * 1000)
                flush()
            }
        }
    }

    private fun startHeartbeatLoop(intervalSeconds: Long) {
        heartbeatJob?.cancel()
        heartbeatJob = scope.launch {
            while (isActive) {
                delay(intervalSeconds * 1000)
                api?.heartbeat()
            }
        }
    }

    private fun queueSize(): Int = synchronized(queueLock) { queue.size }

    private fun now(): String = synchronized(isoFormat) { isoFormat.format(Date()) }

    private fun log(msg: String) {
        if (config.debug) android.util.Log.d("PAAQ", msg)
    }

    private fun getOrCreateDeviceId(context: Context): String {
        val prefs = context.getSharedPreferences("io.paaq.prefs", Context.MODE_PRIVATE)
        val key = "device_id"
        val existing = prefs.getString(key, null)
        if (existing != null) return existing
        val id = UUID.randomUUID().toString()
        prefs.edit().putString(key, id).apply()
        return id
    }
}
