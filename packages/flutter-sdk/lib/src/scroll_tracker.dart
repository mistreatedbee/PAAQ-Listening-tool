import 'package:flutter/widgets.dart';
import 'listening.dart';

/// Opt-in scroll-depth tracking — Flutter has no app-wide scroll hook the
/// way pointer events do, so wrap whichever scrollable view(s) you want
/// measured:
///
/// ```dart
/// PaaqScrollTracker(child: ListView(...))
/// ```
class PaaqScrollTracker extends StatelessWidget {
  final Widget child;
  const PaaqScrollTracker({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return NotificationListener<ScrollNotification>(
      onNotification: (notification) {
        final metrics = notification.metrics;
        if (metrics.maxScrollExtent <= 0) return false;
        final pct = ((metrics.pixels / metrics.maxScrollExtent) * 100).clamp(0, 100).round();
        PAAQ.trackScrollDepth(pct);
        return false;
      },
      child: child,
    );
  }
}
