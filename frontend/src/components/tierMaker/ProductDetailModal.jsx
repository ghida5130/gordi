import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'

import { getProduct } from '@/api/products'
import { getApiErrorMessage } from '@/utils/apiError'

const topSizeColumns = [
  ['sizeName', '사이즈'],
  ['totalLength', '총장'],
  ['shoulderWidth', '어깨'],
  ['chestWidth', '가슴'],
  ['sleeveLength', '소매'],
]

const bottomSizeColumns = [
  ['sizeName', '사이즈'],
  ['totalLength', '총장'],
  ['waistWidth', '허리'],
  ['hipWidth', '엉덩이'],
  ['thighWidth', '허벅지'],
  ['rise', '밑위'],
]

const categoryLabels = {
  TOP: '상의',
  OUTER: '아우터',
  BOTTOM: '하의',
  SHOES: '신발',
}

function formatPrice(price) {
  const value = Number(price)
  return Number.isFinite(value) ? `${value.toLocaleString()}원` : '-'
}

function formatMeasurement(value, key) {
  if (value == null || value === '') return '-'
  return key === 'sizeName' ? value : String(value)
}

function ProductDetailModal({ productId, roomToken, onClose }) {
  const productQuery = useQuery({
    queryKey: ['products', productId],
    queryFn: () => getProduct({ roomToken, productId }),
    enabled: Boolean(productId) && Boolean(roomToken),
    staleTime: 5 * 60 * 1000,
  })
  const product = productQuery.data?.data
  const topSizes = Array.isArray(product?.topSizes) ? product.topSizes : []
  const bottomSizes = Array.isArray(product?.bottomSizes)
    ? product.bottomSizes
    : []
  const sizes = topSizes.length > 0 ? topSizes : bottomSizes
  const sizeColumns = topSizes.length > 0 ? topSizeColumns : bottomSizeColumns

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="tier-maker-product-detail-title"
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <div>
            <p className="text-xs font-bold text-violet-600">PRODUCT DETAIL</p>
            <h2
              id="tier-maker-product-detail-title"
              className="mt-1 text-xl font-black text-slate-950"
            >
              상품 상세정보
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
            aria-label="상품 상세정보 닫기"
          >
            ×
          </button>
        </header>

        {productQuery.isPending ? (
          <div className="flex min-h-96 items-center justify-center">
            <div className="text-center">
              <span className="mx-auto block size-10 animate-spin rounded-full border-4 border-violet-100 border-t-violet-600" />
              <p className="mt-3 text-sm font-semibold text-slate-500">
                상품 정보를 불러오고 있어요
              </p>
            </div>
          </div>
        ) : productQuery.isError ? (
          <div className="p-8">
            <p className="rounded-2xl bg-red-50 px-4 py-5 text-center text-sm text-red-700">
              {getApiErrorMessage(
                productQuery.error,
                '상품 상세정보를 불러오지 못했습니다.',
              )}
            </p>
          </div>
        ) : (
          <div className="grid gap-7 p-6 md:grid-cols-[280px_minmax(0,1fr)]">
            <div className="overflow-hidden rounded-2xl bg-slate-100">
              {product?.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="aspect-[4/5] h-full w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[4/5] items-center justify-center text-sm text-slate-400">
                  상품 이미지가 없습니다
                </div>
              )}
            </div>

            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-500">
                {product?.brand || '브랜드 정보 없음'}
              </p>
              <h3 className="mt-2 text-2xl font-black leading-tight text-slate-950">
                {product?.name}
              </h3>
              <p className="mt-3 text-xl font-black text-violet-700">
                {formatPrice(product?.price)}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                  {categoryLabels[product?.category] ?? product?.category}
                </span>
                {product?.subcategory && (
                  <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-600">
                    {product.subcategory}
                  </span>
                )}
              </div>
              <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {product?.description || '등록된 상품 설명이 없습니다.'}
              </p>
              {product?.purchaseUrl && (
                <a
                  href={product.purchaseUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-700"
                >
                  상품 페이지 열기
                </a>
              )}
            </div>

            <div className="md:col-span-2">
              <div>
                <div>
                  <h3 className="text-lg font-black text-slate-950">
                    사이즈 정보
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    상품 상세 API에서 제공된 실측 정보입니다.
                  </p>
                </div>
              </div>

              {sizes.length > 0 ? (
                <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full min-w-[560px] border-collapse text-center text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500">
                      <tr>
                        {sizeColumns.map(([key, label]) => (
                          <th key={key} className="border-b px-4 py-3 font-bold">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sizes.map((size, index) => (
                        <tr
                          key={size.id ?? `${size.sizeName}-${index}`}
                          className="border-b last:border-b-0"
                        >
                          {sizeColumns.map(([key]) => (
                            <td key={key} className="px-4 py-3 text-slate-700">
                              {formatMeasurement(size[key], key)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                  등록된 사이즈 정보가 없습니다.
                </p>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

export default ProductDetailModal
