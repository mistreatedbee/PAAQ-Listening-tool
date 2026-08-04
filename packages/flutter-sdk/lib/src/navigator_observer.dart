import 'package:flutter/widgets.dart';
import 'listening.dart';

/// Opt-in automatic screen tracking. Flutter has no single universal router,
/// so this is registered explicitly by the host app (matches how Firebase
/// Analytics / Sentry instrument navigation) rather than silently patched in —
///
/// ```dart
/// MaterialApp(
///   navigatorObservers: [PaaqNavigatorObserver()],
///   ...
/// )
/// ```
class PaaqNavigatorObserver extends NavigatorObserver {
  void _trackRoute(Route<dynamic>? route) {
    final name = route?.settings.name;
    if (name != null && name.isNotEmpty) {
      PAAQ.screen(name);
    }
  }

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    _trackRoute(route);
  }

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) {
    _trackRoute(newRoute);
  }

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) {
    _trackRoute(previousRoute);
  }
}
