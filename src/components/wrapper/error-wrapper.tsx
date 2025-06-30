interface Props {
  message: string;
}

export default function ErrorWrapper({ message }: Props) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <p className="text-red-500">{message}</p>
    </div>
  );
}
