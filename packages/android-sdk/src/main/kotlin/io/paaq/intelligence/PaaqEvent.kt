package io.paaq.intelligence

internal data class PaaqEvent(
    val eventName: String,
    val sessionId: String?,
    val properties: Map<String, Any>,
    val timestamp: String,
)
