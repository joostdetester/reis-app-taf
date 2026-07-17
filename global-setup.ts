import { writeVersionEnvironment } from './config/version-tracking';

export default async function globalSetup(): Promise<void> {
  await writeVersionEnvironment();
}
