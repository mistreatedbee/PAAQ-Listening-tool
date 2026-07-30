package io.paaq.intelligence

data class PaaqConfig(
    val sdkToken: String,
    val projectId: String,
    val environment: String = "production",
    val debug: Boolean = false,
    val flushIntervalSeconds: Long = 30L,
    val heartbeatIntervalSeconds: Long = 300L,
    val batchSize: Int = 50,
)
