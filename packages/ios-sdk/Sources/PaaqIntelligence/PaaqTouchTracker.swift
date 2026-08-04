import Foundation
#if canImport(UIKit)
import UIKit

private let rageTapWindowSec: TimeInterval = 0.8
private let rageTapMinCount = 3
private let rageTapRadiusPt: CGFloat = 40
private let deadTapDelaySec: TimeInterval = 2.5

/// Global tap observer, installed once per process via method swizzling on
/// `UIApplication.sendEvent(_:)` — the same technique most RUM/analytics SDKs
/// use for automatic touch capture, since iOS has no per-view-agnostic touch
/// hook the way Android's Window.Callback or Flutter's GestureBinding do.
/// Only observes; the original sendEvent implementation always still runs.
final class PaaqTouchTracker {
    static let shared = PaaqTouchTracker()

    var onRageTap: ((CGPoint, Int) -> Void)?
    var onDeadTap: ((CGPoint) -> Void)?
    var lastSignalAt: () -> Date = { .distantPast }

    private var recentTaps: [(time: Date, point: CGPoint)] = []
    private var rageCooldownUntil = Date.distantPast
    private var installed = false

    func install() {
        guard !installed else { return }
        installed = true
        let cls = UIApplication.self
        let originalSelector = #selector(UIApplication.sendEvent(_:))
        let swizzledSelector = #selector(UIApplication.paaq_sendEvent(_:))
        guard
            let originalMethod = class_getInstanceMethod(cls, originalSelector),
            let swizzledMethod = class_getInstanceMethod(cls, swizzledSelector)
        else { return }
        method_exchangeImplementations(originalMethod, swizzledMethod)
    }

    fileprivate func handle(touches: Set<UITouch>) {
        guard let touch = touches.first, touch.phase == .began else { return }
        let point = touch.location(in: touch.window)
        let now = Date()

        recentTaps.removeAll { now.timeIntervalSince($0.time) > rageTapWindowSec }
        recentTaps.append((now, point))
        let cluster = recentTaps.filter { hypot($0.point.x - point.x, $0.point.y - point.y) <= rageTapRadiusPt }
        if cluster.count >= rageTapMinCount && now > rageCooldownUntil {
            rageCooldownUntil = now.addingTimeInterval(rageTapWindowSec)
            recentTaps.removeAll()
            onRageTap?(point, cluster.count)
        }

        // No cheap way to hit-test "was this a real control" on iOS without
        // walking the view hierarchy, so dead-tap detection here is purely
        // temporal (no signal followed the tap) — a looser heuristic than
        // the web SDK's, documented as such.
        let tapAt = now
        DispatchQueue.main.asyncAfter(deadline: .now() + deadTapDelaySec) { [weak self] in
            guard let self else { return }
            if self.lastSignalAt() < tapAt {
                self.onDeadTap?(point)
            }
        }
    }
}

private extension UIApplication {
    @objc func paaq_sendEvent(_ event: UIEvent) {
        if event.type == .touches, let touches = event.allTouches {
            PaaqTouchTracker.shared.handle(touches: touches)
        }
        // Selectors were swapped by `install()`, so this calls the real
        // original `sendEvent(_:)` implementation.
        self.paaq_sendEvent(event)
    }
}
#endif
