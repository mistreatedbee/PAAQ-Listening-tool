package io.paaq.intelligence

import android.content.Context
import kotlinx.coroutines.*
import java.text.SimpleDateFormat
import java.util.*

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
    private val queue = mutableListOf<PaaqEvent>()
    private val queueLock = Any()
    private var batchSize = 50
    private var config = PaaqConfig("", "")
    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())
    private var flushJob: Job? = null
    private var heartbeatJob: Job? = null
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

        scope.launch {
            try {
                val result = api!!.sdkInit()
                sessionId = result.sessionId
                result.batchSize?.let { batchSize = it }
                val flushInterval = result.flushIntervalSeconds ?: config.flushIntervalSeconds
                log("Initialized — session: $sessionId")
                startFlushLoop(flushInterval)
                startHeartbeatLoop(config.heartbeatIntervalSeconds)
            } catch (e: Exception) {
                log("Init failed: ${e.message}")
            }
        }
    }

    /** Track a custom event */
    fun track(eventName: String, properties: Map<String, Any> = emptyMap()) {
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
        scope.launch { flush() }
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
