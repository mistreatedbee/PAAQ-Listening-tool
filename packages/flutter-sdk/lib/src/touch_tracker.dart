import 'dart:async';
import 'dart:math';
import 'package:flutter/gestures.dart';

const _rageTapWindow = Duration(milliseconds: 800);
const _rageTapMinCount = 3;
const _rageTapRadius = 40.0;
const _deadTapDelay = Duration(milliseconds: 2500);

/// Global tap observer — GestureBinding's pointer router sees every pointer
/// event in the app regardless of hit-testing, so this needs no per-widget
/// opt-in (unlike scroll/form tracking, which have no Flutter-wide
/// equivalent hook and stay opt-in via PaaqScrollTracker/manual calls).
class PaaqTouchTracker {
  final void Function(double x, double y, int count) onRageTap;
  final void Function(double x, double y) onDeadTap;
  final DateTime Function() lastSignalAt;

  PaaqTouchTracker({
    required this.onRageTap,
    required this.onDeadTap,
    required this.lastSignalAt,
  });

  final List<({DateTime time, double x, double y})> _recentTaps = [];
  DateTime _rageCooldownUntil = DateTime.fromMillisecondsSinceEpoch(0);
  bool _installed = false;

  void install() {
    if (_installed) return;
    _installed = true;
    GestureBinding.instance.pointerRouter.addGlobalRoute(_onPointerEvent);
  }

  void _onPointerEvent(PointerEvent event) {
    if (event is! PointerDownEvent) return;
    final now = DateTime.now();
    final x = event.position.dx;
    final y = event.position.dy;

    _recentTaps.removeWhere((t) => now.difference(t.time) > _rageTapWindow);
    _recentTaps.add((time: now, x: x, y: y));
    final cluster = _recentTaps.where((t) => sqrt(pow(t.x - x, 2) + pow(t.y - y, 2)) <= _rageTapRadius).toList();
    if (cluster.length >= _rageTapMinCount && now.isAfter(_rageCooldownUntil)) {
      _rageCooldownUntil = now.add(_rageTapWindow);
      _recentTaps.clear();
      onRageTap(x, y, cluster.length);
    }

    // No cheap way to hit-test "was this a real interactive widget" from a
    // raw pointer event, so dead-tap detection is purely temporal (no
    // signal followed the tap) — a looser heuristic than the web SDK's.
    final tapAt = now;
    Timer(_deadTapDelay, () {
      if (lastSignalAt().isBefore(tapAt)) onDeadTap(x, y);
    });
  }
}
