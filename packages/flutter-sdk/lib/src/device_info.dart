import 'dart:io';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:package_info_plus/package_info_plus.dart';

class DeviceInfoCollector {
  static Future<Map<String, String?>> collect() async {
    final packageInfo = await PackageInfo.fromPlatform();
    final plugin = DeviceInfoPlugin();

    String? deviceType;
    String? os;
    String? osVersion;

    try {
      if (Platform.isAndroid) {
        final info = await plugin.androidInfo;
        deviceType = info.model;
        os = 'Android';
        osVersion = info.version.release;
      } else if (Platform.isIOS) {
        final info = await plugin.iosInfo;
        deviceType = info.utsname.machine;
        os = 'iOS';
        osVersion = info.systemVersion;
      }
    } catch (_) {}

    return {
      'device_type': deviceType,
      'os': os,
      'os_version': osVersion,
      'app_version': packageInfo.version,
    };
  }
}
