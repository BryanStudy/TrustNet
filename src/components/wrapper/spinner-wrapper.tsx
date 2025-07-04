import { Spinner } from "../spinner";

export default function SpinnerWrapper() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Spinner size="large" />
    </div>
  );
}
