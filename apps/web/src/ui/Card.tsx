/** The white bordered surface used for panels, forms and cards across the app. */
export default function Card({
  className = '',
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white ${className}`} {...rest}>
      {children}
    </div>
  )
}
