import { AuthLayout } from "~/components/layout/auth-layout";
import { RegisterForm } from "~/components/auth/register-form";

export default function RegisterPage() {
  return (
    <AuthLayout>
      <RegisterForm />
    </AuthLayout>
  );
}
