// 페이지 콘텐츠의 최대 너비와 좌우 여백을 통일
function PageContainer({ children, className = "" }) {
  return (
    <div
      className={`mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 ${className}`}
    >
      {children}
    </div>
  );
}

export default PageContainer;
