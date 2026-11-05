const PACKAGE_NAME = /^[A-Za-z][\w]*(\.[A-Za-z_][\w]*)+$/;

/**
 * Whether `value` is an Android package name. Package names go into shell commands, so anything
 * else (spaces, quotes, `;`) is refused before it reaches the phone.
 */
export function isPackageName(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length <= 255 && PACKAGE_NAME.test(value);
}

/**
 * The package a target belongs to, or `null`. A WebView in a secondary process reports
 * `com.app:remote`, which is still `com.app`; a placeholder such as `unknown` is no package.
 */
export function packageOfTarget(value: string | null | undefined): string | null {
  const name = value?.split(":")[0]?.trim();
  return isPackageName(name) ? name : null;
}
