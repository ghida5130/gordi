import MyPageIcon from "@/components/mypage/MyPageIcon";

export default function ClothingPlaceholder({ rank }) {
    return (
        <div className="relative flex h-72 items-center justify-center bg-slate-50 sm:h-78">
            {rank && <span className="absolute top-10 text-sm font-medium text-slate-400">{rank}위</span>}
            <MyPageIcon name="hanger" className="size-9 text-slate-300" />
        </div>
    );
}
