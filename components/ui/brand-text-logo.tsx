import Image from "next/image";

export default function BrandTextLogo() {
    return (
        <div className="flex items-center gap-0.5">
            <Image
                src={"/drop-logo.png"}
                alt="Drop logo"
                width={40}
                height={40}
                className="size-6 sm:size-8"
            />
            <h1 className="text-3xl font-semibold tracking-tighter font-logo text-[#0292fe]">Drop</h1>
        </div>
    )
}
