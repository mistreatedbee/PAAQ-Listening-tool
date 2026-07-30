import 'dart:io';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

class DeviceInfoCollector {
  static const _deviceIdKey = 'paaq_device_id';

  /// A stable per-install identifier, persisted across app launches so the
  /// same physical install always maps to the same sdk_installations row.
  static Future<String> deviceId() async {
    final prefs = await SharedPreferences.getInstance();
    var id = prefs.getString(_deviceIdKey);
    if (id == null) {
      id = const Uuid().v4();
      await prefs.setString(_deviceIdKey, id);
    }
    return id;
  }

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
