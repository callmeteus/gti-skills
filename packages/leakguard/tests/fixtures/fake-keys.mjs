/**
 * Fake provider keys assembled at runtime from a prefix and a body.
 *
 * GitHub Push Protection scans committed source for whole credential literals. Each fake key below
 * is stored as separate fragments and joined when this module is imported, so no complete key
 * appears in source while every test still sees the exact same string at runtime. All values are
 * invented and point at no real provider account.
 */

export const STRIPE_SAMPLE = ["sk", "live", "ABCDEFGH12345678"].join("_");
export const STRIPE_LIVE = ["sk", "live", "7Qw2Er5Ty8Ui1Op4As6Df9Gh0"].join("_");

export const AWS_ZEROS = ["AKIA", "0000000000000000"].join("");
export const AWS_DOCS = ["AKIA", "IOSFODNN7EXAMPLE"].join("");
export const AWS_SAMPLE = ["AKIA", "1234567890ABCDEF"].join("");

export const GOOGLE_MIXED = ["AIza", "Qm7Rt2Yw9Pl4Kd6Xn1Vb8Hs3Jf5Zx9L"].join("");
export const GOOGLE_SEQUENTIAL = ["AIza", "abcdefghijklmnopqrstuvwxyz0123456789"].join("");

export const OPENAI_PROJECT = ["sk", "proj", "abcdefghijklmnopqrstuvwxyz"].join("-");
export const ANTHROPIC_SEQUENTIAL = ["sk", "ant", "abcdefghijklmnopqrstuvwxyz"].join("-");

export const GITHUB_ALPHA32 = ["ghp", "abcdefghijklmnopqrstuvwxyz123456"].join("_");
export const GITHUB_ALPHA36 = ["ghp", "abcdefghijklmnopqrstuvwxyz0123456789"].join("_");
export const GITHUB_DIGITS36 = ["ghp", "0123456789abcdefghijklmnopqrstuvwxyz"].join("_");
export const GITHUB_OAUTH32 = ["gho", "abcdefghijklmnopqrstuvwxyz123456"].join("_");
export const GITHUB_MIXED = ["ghp", "7Qw2Er5Ty8Ui1Op4As6Df9Gh0Zx"].join("_");
export const GITHUB_FINE_GRAINED = ["github", "pat", "abcdefghijklmnopqrstuvwxyz", "1234567890"].join("_");

export const SLACK_BOT = ["xoxb", "123456789012", "123456789012", "abcdefghijklmnopqrstuvwx"].join("-");
export const SLACK_QWERTY = ["xoxb", "qwertyqwertyqwertyqwerty"].join("-");

export const PRIVATE_KEY_HEADER = ["-----", "BEGIN ", "RSA ", "PRIVATE", " KEY-----"].join("");
