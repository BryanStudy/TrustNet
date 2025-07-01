import DigitalThreatsModal from "@/components/digital-threats-modal";

export default function MyThreatsPage() {
  return (
    <div className="flex flex-col max-w-7xl mx-auto">
      <h1 className="text-4xl font-sans-bold mt-10">My Threats</h1>
      <div className="flex justify-between my-8">
        <p className="font-mono text-md">Showing 3 Results</p>
        <DigitalThreatsModal />
      </div>
    </div>
  );
}
