try {
  process.loadEnvFile('.env');
} catch {
  // rely on the real environment
}
