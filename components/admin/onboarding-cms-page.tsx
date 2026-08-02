"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ExternalLink,
  Eye,
  LoaderCircle,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { AdminShell } from "@/components/admin/admin-pages";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { AcquisitionFunnelPreview } from "@/components/onboarding/acquisition-funnel";
import {
  applyEditableFields,
  editableFields,
  validateOnboardingPage,
  type OnboardingFunnelPage,
  type OnboardingPageEditableFields,
} from "@/lib/onboarding-funnel";

type PageSummary = {
  id: string;
  index: number;
  path: string;
  slug: string | null;
  type: string;
  title: string;
  interaction: string;
  optionCount: number;
  version: number;
};

const pageTypeLabels: Record<string, string> = {
  "gender-select-landing": "Landing",
  "classic-social-proof": "Social proof",
  "question-page": "Question",
  "wild-page": "Personalized message",
  "followup-teaser-page": "Motivation",
  "magic-page": "Analysis",
  "email-page": "Email capture",
  "enter-name-page": "Name capture",
  "personalized-summary-page": "Summary",
  "before-after-page-personalized": "Before & after",
  "solution-pitch-page": "Solution",
  "social-proof-testimonials-page": "Testimonials",
  "selling-page": "Offer",
};

function fieldsSnapshot(fields: OnboardingPageEditableFields | null) {
  return fields ? JSON.stringify(fields) : "";
}

export function OnboardingCmsPage() {
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [page, setPage] = useState<OnboardingFunnelPage | null>(null);
  const [fields, setFields] = useState<OnboardingPageEditableFields | null>(null);
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [editable, setEditable] = useState(false);
  const [debug, setDebug] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/onboarding", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load onboarding flow");
        if (!active) return;
        setPages(data.pages);
        setSelectedId(data.pages[0]?.id ?? "");
        setEditable(Boolean(data.editable));
        setDebug(Boolean(data.debug));
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "Unable to load onboarding flow"))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    fetch(`/api/admin/onboarding/${encodeURIComponent(selectedId)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load page");
        if (!active) return;
        const nextFields = editableFields(data.page);
        setPage(data.page);
        setFields(nextFields);
        setSaved(fieldsSnapshot(nextFields));
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "Unable to load page"))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [selectedId]);

  const dirty = fieldsSnapshot(fields) !== saved;
  const draftPage = useMemo(
    () => page && fields ? applyEditableFields(page, fields) : page,
    [page, fields],
  );
  const validation = draftPage ? validateOnboardingPage(draftPage) : [];
  const update = (next: Partial<OnboardingPageEditableFields>) => {
    setFields((current) => current ? { ...current, ...next } : current);
    setMessage("");
    setError("");
  };
  const publish = async () => {
    if (!page || !fields || !dirty || validation.length) return;
    setPublishing(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/onboarding/${encodeURIComponent(page.id)}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          fields,
          expectedVersion: page.version ?? 1,
          changeSummary: "Updated onboarding page in visual editor",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to publish changes");
      const nextFields = editableFields(data.page);
      setPage(data.page);
      setFields(nextFields);
      setSaved(fieldsSnapshot(nextFields));
      setPages((current) => current.map((item) => item.id === data.page.id
        ? { ...item, title: data.page.title, optionCount: data.page.options.length, version: data.page.version }
        : item));
      setMessage(data.debug
        ? "Preview published in debug memory. Restarting the server will restore reference-v1."
        : "Onboarding page published.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to publish changes");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <AdminShell
      title="Onboarding CMS"
      subtitle="Edit the 29-page acquisition flow without touching code"
    >
      <div className="onboarding-cms">
        <div className="onboarding-cms-toolbar">
          <div>
            <span><Sparkles />REFERENCE-V1</span>
            <strong>Personalized AI Certificate Program</strong>
            <small>29 pages · 16 questions · c-1185</small>
          </div>
          <div>
            <Link href="/dynamic?prc_id=1185" target="_blank" rel="noreferrer">
              <ExternalLink />Open live flow
            </Link>
            <button type="button" className={preview ? "active" : ""} onClick={() => setPreview((value) => !value)}>
              <Eye />Preview
            </button>
            <button
              type="button"
              className="primary"
              disabled={!editable || !dirty || publishing || validation.length > 0}
              onClick={() => void publish()}
              title={!dirty ? "Make a change to activate Publish" : validation[0]}
            >
              {publishing ? <LoaderCircle className="spin" /> : dirty ? <Save /> : <Check />}
              {publishing ? "Publishing…" : dirty ? "Publish changes" : "Published"}
            </button>
          </div>
        </div>

        <nav className="onboarding-page-tabs" aria-label="Onboarding pages">
          {pages.map((item) => (
            <button
              type="button"
              key={item.id}
              className={item.id === selectedId ? "active" : ""}
              onClick={() => {
                setLoading(true);
                setError("");
                setMessage("");
                setSelectedId(item.id);
              }}
              title={`${item.index + 1}. ${item.title}`}
            >
              <span>{item.index + 1}</span>
              <strong>{item.title || pageTypeLabels[item.type] || item.type}</strong>
              <small>{pageTypeLabels[item.type] || item.type}</small>
            </button>
          ))}
        </nav>

        {debug && (
          <div className="onboarding-debug-note">
            <AlertCircle />Debug workspace: changes are memory-only and never write to Firebase or Storage.
          </div>
        )}
        {message && <p className="cms-message" role="status">{message}</p>}
        {error && <p className="onboarding-cms-error" role="alert"><AlertCircle />{error}</p>}

        {loading || !page || !fields || !draftPage ? (
          <div className="onboarding-cms-loading"><LoaderCircle className="spin" />Loading page editor…</div>
        ) : (
          <div className={`onboarding-editor-grid ${preview ? "" : "without-preview"}`}>
            <section className="onboarding-copy-editor">
              <header>
                <div>
                  <span>PAGE {page.index + 1}</span>
                  <h2>{pageTypeLabels[page.type] || page.type}</h2>
                  <p>Version {page.version ?? 1} · {page.path}</p>
                </div>
                <span className={dirty ? "dirty" : ""}>{dirty ? "Unpublished changes" : "Up to date"}</span>
              </header>

              <div className="onboarding-field-card">
                <RichTextEditor
                  label="Main title"
                  value={fields.title}
                  inline
                  placeholder="What should the learner see first?"
                  onChange={(title) => update({ title })}
                />
                <RichTextEditor
                  label="Supporting text"
                  value={fields.subtitle}
                  placeholder="Add a short explanation or reassurance…"
                  onChange={(subtitle) => update({ subtitle })}
                />
                <RichTextEditor
                  label="Additional description"
                  value={fields.description}
                  placeholder="Optional longer description…"
                  onChange={(description) => update({ description })}
                />
              </div>

              {page.interaction === "selection" && (
                <section className="onboarding-options-editor">
                  <header>
                    <div><h3>Answer choices</h3><p>Labels are editable; stable IDs stay protected.</p></div>
                    <button
                      type="button"
                      onClick={() => update({
                        options: [
                          ...fields.options,
                          {
                            id: `option-${crypto.randomUUID().slice(0, 8)}`,
                            label: "New choice",
                            value: null,
                            source: { title: "New choice", slug: `new-${Date.now()}` },
                          },
                        ],
                      })}
                    >
                      <Plus />Add choice
                    </button>
                  </header>
                  <div>
                    {fields.options.map((option, index) => (
                      <label key={option.id}>
                        <span>{index + 1}</span>
                        <input
                          value={option.label}
                          aria-label={`Choice ${index + 1}`}
                          onChange={(event) => update({
                            options: fields.options.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, label: event.target.value } : item),
                          })}
                        />
                        <button
                          type="button"
                          aria-label={`Delete choice ${index + 1}`}
                          disabled={fields.options.length <= 2}
                          onClick={() => update({ options: fields.options.filter((_, itemIndex) => itemIndex !== index) })}
                        >
                          <Trash2 />
                        </button>
                      </label>
                    ))}
                  </div>
                </section>
              )}

              {validation.length > 0 && (
                <div className="onboarding-validation">
                  <strong><AlertCircle />Fix before publishing</strong>
                  {validation.map((item) => <p key={item}>{item}</p>)}
                </div>
              )}

              <details className="onboarding-technical">
                <summary>Technical details</summary>
                <dl>
                  <div><dt>Stable page ID</dt><dd>{page.id}</dd></div>
                  <div><dt>Route</dt><dd>{page.path}</dd></div>
                  <div><dt>Source type</dt><dd>{page.type}</dd></div>
                  <div><dt>Interaction</dt><dd>{page.interaction}</dd></div>
                </dl>
              </details>
            </section>

            {preview && (
              <aside className="onboarding-preview-panel">
                <header>
                  <div><span>LIVE PREVIEW</span><strong>Desktop / mobile-safe</strong></div>
                  <ArrowRight />
                </header>
                <AcquisitionFunnelPreview page={draftPage} />
              </aside>
            )}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
