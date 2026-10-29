import { WithFullkodCredit } from "@/components/FullkodCredit";

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WithFullkodCredit>{children}</WithFullkodCredit>;
}
