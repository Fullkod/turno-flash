import { WithFullkodCredit } from "@/components/FullkodCredit";

export default function AccountDeletionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WithFullkodCredit>{children}</WithFullkodCredit>;
}
