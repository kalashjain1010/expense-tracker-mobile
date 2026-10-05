package expo.modules.androidsms

import android.Manifest
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.provider.Telephony
import androidx.core.content.ContextCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.exception.Exceptions

class AndroidSmsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AndroidSms")

    AsyncFunction("hasPermission") {
      val ctx = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      ContextCompat.checkSelfPermission(ctx, Manifest.permission.READ_SMS) ==
        PackageManager.PERMISSION_GRANTED
    }

    AsyncFunction("requestPermission") { promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.resolve(false)
        return@AsyncFunction
      }
      // Expo Permissions can also be used from JS; this mirrors grant state after system dialog
      val ctx = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val granted =
        ContextCompat.checkSelfPermission(ctx, Manifest.permission.READ_SMS) ==
          PackageManager.PERMISSION_GRANTED
      promise.resolve(granted)
    }

    AsyncFunction("listInbox") { minDateMs: Double, maxCount: Int, promise: Promise ->
      val ctx = appContext.reactContext
      if (ctx == null) {
        promise.reject("E_NO_CTX", "React context lost", null)
        return@AsyncFunction
      }
      if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.READ_SMS) !=
          PackageManager.PERMISSION_GRANTED
      ) {
        promise.reject("E_NO_PERM", "READ_SMS not granted", null)
        return@AsyncFunction
      }

      val out = mutableListOf<Map<String, Any?>>()
      val uri: Uri = Telephony.Sms.Inbox.CONTENT_URI
      val projection =
        arrayOf(
          Telephony.Sms._ID,
          Telephony.Sms.ADDRESS,
          Telephony.Sms.BODY,
          Telephony.Sms.DATE,
        )
      val selection = "${Telephony.Sms.DATE} > ?"
      val selectionArgs = arrayOf(minDateMs.toLong().toString())
      val sort = "${Telephony.Sms.DATE} DESC"
      var cursor: Cursor? = null
      try {
        cursor =
          ctx.contentResolver.query(uri, projection, selection, selectionArgs, sort)
        if (cursor != null) {
          val idIdx = cursor.getColumnIndexOrThrow(Telephony.Sms._ID)
          val addrIdx = cursor.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
          val bodyIdx = cursor.getColumnIndexOrThrow(Telephony.Sms.BODY)
          val dateIdx = cursor.getColumnIndexOrThrow(Telephony.Sms.DATE)
          var n = 0
          while (cursor.moveToNext() && n < maxCount) {
            out.add(
              mapOf(
                "id" to cursor.getString(idIdx),
                "address" to (cursor.getString(addrIdx) ?: ""),
                "body" to (cursor.getString(bodyIdx) ?: ""),
                "date" to cursor.getLong(dateIdx),
              )
            )
            n++
          }
        }
        promise.resolve(out)
      } catch (e: Exception) {
        promise.reject("E_SMS", e.message, e)
      } finally {
        cursor?.close()
      }
    }
  }
}
