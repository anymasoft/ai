import Link from "next/link";
import Image from "next/image";

export default function Logo() {
  return (
    <Link href="/" className="inline-flex items-center gap-2" aria-label="Video Reader AI">
      <Image src="/images/logo-01.png" width={32} height={32} alt="Video Reader AI" />
      <span className="text-lg font-semibold text-gray-900">Video Reader AI</span>
    </Link>
  );
}
