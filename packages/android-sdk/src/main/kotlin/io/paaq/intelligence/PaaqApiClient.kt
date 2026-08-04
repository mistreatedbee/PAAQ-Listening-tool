package io.paaq.intelligence

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

private const val BASE_URL = "https://mookyonwpovxscsbqwwl.supabase.co/functions/v1"
private const val SDK_VERSION = "1.0.0"

internal class PaaqApiClient(private val config: PaaqConfig, private val deviceId: String) {

    private fun applyHeaders(conn: HttpURLConnection) {
        conn.setRequestProperty("Content-Type", "application/json")
        conn.setRequestProperty("Authorization", "Bearer ${config.sdkToken}")
        conn.setRequestProperty("X-Project-ID", config.projectId)
        conn.setRequestProperty("X-SDK-Version", SDK_VERSION)
        conn.setRequestProperty("X-Platform", "android")
        conn.setRequestProperty("X-Environment", config.environment)
    }

    private fun post(path: String, body: String): String? {
        return try {
            val conn = (URL("$BASE_URL/$path").openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                doOutput = true
                connectTimeout = 10_000
                readTimeout = 10_000
                applyHeaders(this)
            }
            OutputStreamWriter(conn.outputStream).use { it.write(body) }
            if (conn.responseCode in 200..299) {
                conn.inputStream.bufferedReader().readText()
            } else null
        } catch (_: Exception) { null }
    }

    /**
     * Uploads one recording chunk (a JPEG screenshot for Android) to the
     * private session-recordings bucket. Query-param metadata, raw bytes as
     * the body — mirrors the web SDK's upload shape.
     */
    suspend fun uploadRecordingChunk(
        sessionId: String,
        sequence: Int,
        capturedAtIso: String,
        bytes: ByteArray,
        contentType: String,
    ) = withContext(Dispatchers.IO) {
        try {
            val encodedCapturedAt = java.net.URLEncoder.encode(capturedAtIso, "UTF-8")
            val url = "$BASE_URL/session-recording-upload?session_id=$sessionId&kind=screenshots&sequence=$sequence&captured_at=$encodedCapturedAt"
            val conn = (URL(url).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                doOutput = true
                connectTimeout = 10_000
                readTimeout = 10_000
                setRequestProperty("Content-Type", contentType)
                setRequestProperty("Authorization", "Bearer ${config.sdkToken}")
                setRequestProperty("X-Project-ID", config.projectId)
            }
            conn.outputStream.use { it.write(bytes) }
            conn.responseCode
        } catch (_: Exception) {
            // fire-and-forget — a missed screenshot just leaves a gap in playback
        }
    }

    data class InitResult(val sessionId: String?, val batchSize: Int?, val flushIntervalSeconds: Long?)

    /**
     * Real device metadata reported once at init — first-party Android APIs
     * only (Build.*, DisplayMetrics), nothing inferred or backfilled
     * server-side.
     */
    data class DeviceMetadata(
        val osVersion: String,
        val deviceModel: String,
        val appVersion: String?,
        val screenWidth: Int?,
        val screenHeight: Int?,
    )

    suspend fun sdkInit(deviceMetadata: DeviceMetadata? = null): InitResult = withContext(Dispatchers.IO) {
        val body = JSONObject().put("deviceId", deviceId).apply {
            if (deviceMetadata != null) {
                put("appVersion", deviceMetadata.appVersion)
                put("deviceMetadata", JSONObject()
                    .put("osName", "Android")
                    .put("osVersion", deviceMetadata.osVersion)
                    .put("deviceModel", deviceMetadata.deviceModel)
                    .put("deviceType", "mobile")
                    .put("screenWidth", deviceMetadata.screenWidth)
                    .put("screenHeight", deviceMetadata.screenHeight))
            }
        }.toString()
        val response = post("sdk-init", body) ?: return@withContext InitResult(null, null, null)
        val json = JSONObject(response)
        val sessionId = if (json.has("sessionId")) json.getString("sessionId") else null
        val cfg = if (json.has("config")) json.getJSONObject("config") else null
        val batchSize = cfg?.optInt("batchSize")
        val flushSecs = cfg?.optLong("syncIntervalSeconds")
        InitResult(sessionId, batchSize, flushSecs)
    }

    suspend fun endSession(sessionId: String, durationSeconds: Long, outcome: String) = withContext(Dispatchers.IO) {
        val body = JSONObject()
            .put("action", "end")
            .put("session_id", sessionId)
            .put("duration", durationSeconds)
            .put("outcome", outcome)
            .toString()
        post("sessions", body)
    }

    suspend fun flush(events: List<PaaqEvent>) = withContext(Dispatchers.IO) {
        if (events.isEmpty()) return@withContext
        val arr = JSONArray()
        events.forEach { e ->
            val obj = JSONObject()
                .put("event_name", e.eventName)
                .put("session_id", e.sessionId)
                .put("timestamp", e.timestamp)
            val props = JSONObject()
            e.properties.forEach { (k, v) -> props.put(k, v) }
            obj.put("properties", props)
            arr.put(obj)
        }
        post("events", arr.toString())
    }

    suspend fun heartbeat() = withContext(Dispatchers.IO) {
        val body = JSONObject().put("deviceId", deviceId).toString()
        post("sdk-heartbeat", body)
    }
}
