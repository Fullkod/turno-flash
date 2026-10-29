import { WithFullkodCredit } from "@/components/FullkodCredit";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WithFullkodCredit pinned>{children}</WithFullkodCredit>;
}
