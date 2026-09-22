export function Logo({
  className,
  width = 120,
  height = 40,
  'data-id': dataId





}: {className?: string;width?: number;height?: number;'data-id'?: string;}) {
  return (
    <img
      src="/bckashlogoNew.png"
      alt="Logo"
      className={className}
      style={{
        width,
        height,
        objectFit: 'contain'
      }}
      data-id={dataId} />);


}