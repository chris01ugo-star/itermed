import { config } from "@/lib/config";
import { SignupForm } from "./SignupForm";

export default function SignupPage() {
  return <SignupForm googleEnabled={config.isGoogleAuthConfigured} />;
}
