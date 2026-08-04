import { useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { sendApiTestRequest } from "@/api/apiTest";
import PageContainer from "@/components/common/PageContainer";
import { getAccessToken } from "@/utils/tokenStorage";

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

const inputClassName = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

function getResponseHeaders(headers) {
    if (!headers) {
        return {};
    }

    return typeof headers.toJSON === "function" ? headers.toJSON() : headers;
}

function createErrorResponse(error) {
    return {
        status: error.response?.status ?? null,
        statusText: error.response?.statusText ?? "요청 실패",
        headers: getResponseHeaders(error.response?.headers),
        data: error.response?.data ?? {
            name: error.name,
            message: error.message,
        },
    };
}

function ApiExamplePage() {
    const [method, setMethod] = useState("GET");
    const [url, setUrl] = useState("");
    const [includeAccessToken, setIncludeAccessToken] = useState(false);
    const [bodyMode, setBodyMode] = useState("keyValue");
    const [bodyRows, setBodyRows] = useState([{ id: 1, key: "", value: "" }]);
    const [nextRowId, setNextRowId] = useState(2);
    const [jsonBody, setJsonBody] = useState("");
    const [jsonError, setJsonError] = useState("");
    const [requestContent, setRequestContent] = useState(null);
    const [responseContent, setResponseContent] = useState(null);

    const requestMutation = useMutation({
        mutationFn: sendApiTestRequest,
        onSuccess: (response) => {
            setResponseContent(response);
        },
        onError: (error) => {
            setResponseContent(createErrorResponse(error));
        },
    });

    const updateBodyRow = (id, field, value) => {
        setBodyRows((currentRows) => currentRows.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
    };

    const addBodyRow = () => {
        setBodyRows((currentRows) => [...currentRows, { id: nextRowId, key: "", value: "" }]);
        setNextRowId((currentId) => currentId + 1);
    };

    const removeBodyRow = (id) => {
        setBodyRows((currentRows) => currentRows.filter((row) => row.id !== id));
    };

    const getRequestBody = () => {
        if (bodyMode === "json") {
            if (!jsonBody.trim()) {
                return undefined;
            }

            return JSON.parse(jsonBody);
        }

        return bodyRows.reduce((body, row) => {
            if (row.key.trim()) {
                body[row.key.trim()] = row.value;
            }
            return body;
        }, {});
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        setJsonError("");

        let body;

        try {
            body = getRequestBody();
        } catch {
            setJsonError("올바른 JSON 형식으로 입력해 주세요.");
            return;
        }

        const storedAccessToken = getAccessToken();
        const request = {
            method,
            url,
            headers: includeAccessToken
                ? {
                      Authorization: storedAccessToken ? `Bearer ${storedAccessToken}` : "<저장된 accessToken 없음>",
                  }
                : {},
            body,
        };

        setRequestContent(request);
        setResponseContent(null);
        requestMutation.mutate({
            method,
            url,
            includeAccessToken,
            accessToken: storedAccessToken,
            body,
        });
    };

    return (
        <main className="min-h-screen bg-gray-50 py-10">
            <PageContainer>
                <header>
                    <p className="text-sm font-semibold text-brand-600">API TESTER</p>
                    <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">API 요청 테스트</h1>
                    <p className="mt-3 text-sm leading-6 text-slate-600">HTTP 메서드와 인증 여부를 선택하고 요청·응답 내용을 한 화면에서 확인할 수 있습니다.</p>
                </header>
                <form onSubmit={handleSubmit} className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                    <div className="grid gap-5 lg:grid-cols-[180px_minmax(0,1fr)_auto] lg:items-end">
                        <label>
                            <span className="mb-2 block text-sm font-semibold text-slate-700">HTTP 메서드</span>
                            <select value={method} onChange={(event) => setMethod(event.target.value)} className={inputClassName}>
                                {HTTP_METHODS.map((httpMethod) => (
                                    <option key={httpMethod} value={httpMethod}>
                                        {httpMethod}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label>
                            <span className="mb-2 block text-sm font-semibold text-slate-700">요청 URL</span>
                            <input type="text" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="/api/v1/" required className={inputClassName} />
                        </label>

                        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-300 px-4 py-2.5">
                            <input type="checkbox" checked={includeAccessToken} onChange={(event) => setIncludeAccessToken(event.target.checked)} className="size-4 accent-indigo-600" />
                            <span className="whitespace-nowrap text-sm font-semibold text-slate-700">accessToken 포함</span>
                        </label>
                    </div>

                    <div className="mt-8 border-t border-slate-200 pt-7">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Request Body</h2>
                                <p className="mt-1 text-sm text-slate-500">선택한 입력 방식의 내용이 요청 본문으로 전송됩니다.</p>
                            </div>

                            <div className="flex rounded-lg bg-slate-100 p-1">
                                <button
                                    type="button"
                                    onClick={() => setBodyMode("keyValue")}
                                    className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                                        bodyMode === "keyValue" ? "bg-white text-brand-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
                                    }`}
                                >
                                    Key-Value
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setBodyMode("json")}
                                    className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                                        bodyMode === "json" ? "bg-white text-brand-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
                                    }`}
                                >
                                    JSON 자유 입력
                                </button>
                            </div>
                        </div>

                        {bodyMode === "keyValue" ? (
                            <div className="mt-5">
                                <div className="hidden grid-cols-[1fr_1fr_44px] gap-3 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid">
                                    <span>Key</span>
                                    <span>Value</span>
                                    <span className="sr-only">제거</span>
                                </div>

                                <div className="mt-2 space-y-3">
                                    {bodyRows.map((row) => (
                                        <div key={row.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_44px] sm:gap-3">
                                            <input
                                                type="text"
                                                value={row.key}
                                                onChange={(event) => updateBodyRow(row.id, "key", event.target.value)}
                                                placeholder="key"
                                                aria-label="Body key"
                                                className={inputClassName}
                                            />
                                            <input
                                                type="text"
                                                value={row.value}
                                                onChange={(event) => updateBodyRow(row.id, "value", event.target.value)}
                                                placeholder="value"
                                                aria-label="Body value"
                                                className={inputClassName}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeBodyRow(row.id)}
                                                aria-label="Body 항목 제거"
                                                className="h-11 rounded-lg border border-slate-300 text-xl text-slate-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    type="button"
                                    onClick={addBodyRow}
                                    className="mt-4 rounded-lg border border-dashed border-brand-500 px-4 py-2.5 text-sm font-semibold text-brand-600 transition hover:bg-brand-50"
                                >
                                    + 항목 추가
                                </button>
                            </div>
                        ) : (
                            <div className="mt-5">
                                <textarea
                                    value={jsonBody}
                                    onChange={(event) => {
                                        setJsonBody(event.target.value);
                                        setJsonError("");
                                    }}
                                    rows={12}
                                    spellCheck={false}
                                    placeholder={'{\n  "items": [1, 2, 3]\n}'}
                                    aria-label="JSON request body"
                                    className={`${inputClassName} resize-y font-mono leading-6`}
                                />
                                {jsonError && <p className="mt-2 text-sm font-medium text-red-600">{jsonError}</p>}
                            </div>
                        )}
                    </div>

                    <div className="mt-7 flex justify-end">
                        <button
                            type="submit"
                            disabled={requestMutation.isPending}
                            className="rounded-lg bg-brand-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {requestMutation.isPending ? "요청 전송 중..." : "요청 보내기"}
                        </button>
                    </div>
                </form>

                <div className="mt-8 grid gap-6 lg:grid-cols-2">
                    <ResultPanel title="Request" content={requestContent} />
                    <ResultPanel title="Response" content={responseContent} isPending={requestMutation.isPending} />
                </div>
            </PageContainer>
        </main>
    );
}

function ResultPanel({ title, content, isPending = false }) {
    return (
        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
                <h2 className="font-bold text-white">{title}</h2>
                {title === "Response" && content?.status && (
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${content.status >= 200 && content.status < 300 ? "bg-emerald-400/15 text-emerald-300" : "bg-red-400/15 text-red-300"}`}>
                        {content.status} {content.statusText}
                    </span>
                )}
            </div>
            <div className="min-h-80 p-5">
                {isPending ? (
                    <p className="text-sm text-slate-400">응답을 기다리고 있습니다...</p>
                ) : content ? (
                    <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-all font-mono text-xs leading-6 text-slate-200">{JSON.stringify(content, null, 2)}</pre>
                ) : (
                    <p className="text-sm text-slate-500">요청을 보내면 {title.toLowerCase()} 내용이 표시됩니다.</p>
                )}
            </div>
        </section>
    );
}

export default ApiExamplePage;
