import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function Test() {
  return (
    <div className="flex justify-center min-h-screen w-full items-center bg-[var(--c-silver)]">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Digital Threats</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-sans text-sm text-[var(--c-coal)]">
            This is a phishing link designed to steal your personal information
            and credentials. Never click on suspicious links or enter your data
            on untrusted websites.
          </p>
          <Badge className="mt-4 font-mono bg-[var(--c-violet)] px-2 py-1">
            www.scamlink.com
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}
