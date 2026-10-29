import { WithFullkodCredit } from "@/components/FullkodCredit";

export default function HelpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WithFullkodCredit>{children}</WithFullkodCredit>;
}
