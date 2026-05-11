import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Troasel Ads</h1>
          <p className="mt-1 text-sm text-gray-500">
            Ad commission platform for advertisers
          </p>
        </div>
        <SignIn />
      </div>
    </div>
  );
}
