import { WithFullkodCredit } from "@/components/FullkodCredit";

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WithFullkodCredit>{children}</WithFullkodCredit>;
}
