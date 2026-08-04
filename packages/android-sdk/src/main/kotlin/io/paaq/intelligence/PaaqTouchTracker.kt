package io.paaq.intelligence

import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.MotionEvent
import android.view.Window
import kotlin.math.hypot

private const val RAGE_TAP_WINDOW_MS = 800L
private const val RAGE_TAP_MIN_COUNT = 3
private const val RAGE_TAP_RADIUS_PX = 120f // generous, since px-per-dp varies across devices
private const val DEAD_TAP_DELAY_MS = 2500L

/**
 * Global tap observer for one Activity — Window.Callback is the same hook
 * Android itself uses to dispatch touches to views, so wrapping it lets us
 * see every tap automatically, with no per-view opt-in required (unlike
 * scroll/form tracking, which have no equivalent universal hook and stay
 * opt-in). We only observe; dispatchTouchEvent's return value always comes
 * from the real callback so app behavior is untouched.
 *
 * Unlike the web SDK, this has no cheap way to hit-test "was this a real
 * button" — so dead-tap detection here is purely temporal (no signal
 * followed the tap), a looser heuristic than web's, documented as such.
 */
internal class PaaqTouchTracker(
    private val onRageTap: (x: Float, y: Float, count: Int) -> Unit,
    private val onDeadTap: (x: Float, y: Float) -> Unit,
    private val lastSignalAtMs: () -> Long,
) {
    private data class Tap(val time: Long, val x: Float, val y: Float)
    private val recentTaps = mutableListOf<Tap>()
    private var rageCooldownUntil = 0L
    private val handler = Handler(Looper.getMainLooper())

    fun onTouchEvent(event: MotionEvent) {
        if (event.action != MotionEvent.ACTION_DOWN) return
        val now = SystemClock.elapsedRealtime()
        val x = event.rawX
        val y = event.rawY

        recentTaps.removeAll { now - it.time > RAGE_TAP_WINDOW_MS }
        recentTaps.add(Tap(now, x, y))
        val cluster = recentTaps.filter { hypot((it.x - x).toDouble(), (it.y - y).toDouble()) <= RAGE_TAP_RADIUS_PX }
        if (cluster.size >= RAGE_TAP_MIN_COUNT && now > rageCooldownUntil) {
            rageCooldownUntil = now + RAGE_TAP_WINDOW_MS
            recentTaps.clear()
            onRageTap(x, y, cluster.size)
        }

        val tapAtMs = System.currentTimeMillis()
        handler.postDelayed({
            if (lastSignalAtMs() < tapAtMs) onDeadTap(x, y)
        }, DEAD_TAP_DELAY_MS)
    }
}

internal class PaaqWindowCallbackWrapper(
    private val delegate: Window.Callback,
    private val tracker: PaaqTouchTracker,
) : Window.Callback by delegate {
    override fun dispatchTouchEvent(event: MotionEvent): Boolean {
        tracker.onTouchEvent(event)
        return delegate.dispatchTouchEvent(event)
    }
}
