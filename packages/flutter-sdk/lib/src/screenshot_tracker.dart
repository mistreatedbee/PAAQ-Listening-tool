import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';

typedef ScreenshotCapture = Future<Uint8List?> Function();

/// Bridges the widget tree (which owns the RenderRepaintBoundary) to PAAQ's
/// periodic capture loop (a plain Dart Timer, outside the widget tree).
class PaaqScreenshotRegistry {
  static ScreenshotCapture? _capture;
  static void register(ScreenshotCapture capture) => _capture = capture;
  static void unregister() => _capture = null;
  static Future<Uint8List?> captureNow() async => _capture?.call();
}

/// Wrap your app root to enable visual session replay — Flutter has no
/// app-wide "capture the current screen" API, so this is the opt-in
/// mechanism (matches PaaqScrollTracker/PaaqNavigatorObserver):
///
/// ```dart
/// PaaqScreenshotBoundary(child: MaterialApp(...))
/// ```
class PaaqScreenshotBoundary extends StatefulWidget {
  final Widget child;
  const PaaqScreenshotBoundary({super.key, required this.child});

  @override
  State<PaaqScreenshotBoundary> createState() => _PaaqScreenshotBoundaryState();
}

class _PaaqScreenshotBoundaryState extends State<PaaqScreenshotBoundary> {
  final GlobalKey _key = GlobalKey();

  @override
  void initState() {
    super.initState();
    PaaqScreenshotRegistry.register(_capture);
  }

  @override
  void dispose() {
    PaaqScreenshotRegistry.unregister();
    super.dispose();
  }

  Future<Uint8List?> _capture() async {
    try {
      final boundary = _key.currentContext?.findRenderObject() as RenderRepaintBoundary?;
      if (boundary == null || boundary.debugNeedsPaint) return null;
      // Reduced pixelRatio to keep upload size reasonable — no JPEG encoder
      // is available in dart:ui without an extra image-processing
      // dependency, so this trades resolution for size instead.
      final image = await boundary.toImage(pixelRatio: 0.5);
      final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
      image.dispose();
      return byteData?.buffer.asUint8List();
    } catch (_) {
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(key: _key, child: widget.child);
  }
}
