/** Page title header row. */
export function PageHeader({ title }: { title: string }) {
  return (
    <div className="mx-(--body-gutter) pt-7 pb-1">
      <h1 className="type-header-emphasized">{title}</h1>
    </div>
  );
}
