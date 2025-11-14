import Link from "next/link";
import Image from "next/image";
import LogoImage from "@/public/images/logo-01.svg";

export default function Logo() {
  return (
    <Link href="/" className="inline-flex" aria-label="Video Reader AI">
      <Image src={LogoImage} width={32} height={32} alt="Video Reader AI" />
    </Link>
  );
}
