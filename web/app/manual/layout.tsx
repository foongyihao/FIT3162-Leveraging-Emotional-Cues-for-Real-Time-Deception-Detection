export default function ManualLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex-1 h-full w-full">
      {children}
    </div>
  );
}
