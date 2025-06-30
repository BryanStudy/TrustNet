import { UserInfo } from "@/hooks/useUser";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { constructFileUrl } from "@/utils/fileUtils";

interface UserCardProps {
  userInfo: UserInfo;
}

export default function UserCard({ userInfo }: UserCardProps) {
  return (
    <Link href="/profile" className="block">
      <Card
        className="flex items-center gap-3 px-4 py-3 m-1 cursor-pointer transition-colors hover:bg-[var(--c-mauve)] w-auto"
        tabIndex={0}
      >
        <div className="flex items-center gap-x-3 px-2 mx-2">
          <Avatar className="size-8 rounded-lg">
            <AvatarImage
              src={constructFileUrl(userInfo.picture, "profile-pictures")}
              alt={userInfo.firstName + " " + userInfo.lastName}
            />
          </Avatar>
          <div className="flex flex-col">
            <span className="font-extrabold text-sm truncate max-w-[160px]">
              {userInfo.firstName} {userInfo.lastName}
            </span>
            <span className="text-[0.8rem] text-muted-foreground truncate max-w-[160px]">
              {userInfo.email}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
