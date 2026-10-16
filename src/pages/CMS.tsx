import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Edit, Eye } from "lucide-react";
import { api } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

interface CMSContent {
  id: string;
  title: string;
  slug: string;
  content: string;
  category: "blog" | "announcement" | "help" | "faq";
  status: "draft" | "published";
  author?: string;
  createdAt: Date;
  updatedAt: Date;
  excerpt?: string;
  featured?: boolean;
}

const CMS = () => {
  const { t } = useLanguage();
  const catLabel = (c: string) => c === "blog" ? t("cms_blog") : c === "announcement" ? t("cms_announcement") : c === "help" ? t("cms_help") : t("cms_faq");
  const [contents, setContents] = useState<CMSContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchContents = async () => {
    setLoading(true);
    try {
      const [pub, draft] = await Promise.all([
        api.cms.list({ status: "published" }).catch(() => []),
        api.cms.list({ status: "draft" }).catch(() => []),
      ]);
      const map = (r: any): CMSContent => ({
        id: String(r.id),
        title: String(r.title || "Untitled"),
        slug: String(r.slug || ""),
        content: String(r.content || ""),
        category: (r.category as any) || "announcement",
        status: (r.status as any) || "draft",
        author: "Admin",
        createdAt: r.created_at ? new Date(r.created_at) : new Date(),
        updatedAt: new Date(),
        excerpt: String(r.excerpt || ""),
      });
      setContents([...(pub as any[]).map(map), ...(draft as any[]).map(map)]);
    } catch {
      toast.error(t("cms_load_failed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchContents(); }, []);

  const [activeTab, setActiveTab] = useState("blog");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<CMSContent>>({
    title: "",
    slug: "",
    content: "",
    category: "blog",
    status: "draft",
    author: "Admin",
    excerpt: "",
  });

  const handleAdd = async () => {
    if (formData.title && formData.content) {
      setSaving(true);
      try {
        const payload = {
          title: formData.title,
          slug: formData.slug || formData.title.toLowerCase().replace(/\s+/g, "-"),
          content: formData.content,
          category: (formData.category as any) || "blog",
          status: (formData.status as any) || "draft",
          excerpt: formData.excerpt || "",
        };
        if (editingId) {
          await api.cms.update(editingId, payload);
          toast.success(t("cms_updated"));
          setEditingId(null);
        } else {
          await api.cms.create(payload);
          toast.success(t("cms_published"));
        }
        await fetchContents();
      } catch (e: any) {
        toast.error(t("cms_save_failed") + ": " + (e.message || ""));
        setSaving(false);
        return;
      }
      setSaving(false);

      setFormData({
        title: "",
        slug: "",
        content: "",
        category: "blog",
        status: "draft",
        author: "Admin",
        excerpt: "",
      });
    }
  };

  const handleEdit = (content: CMSContent) => {
    setEditingId(content.id);
    setFormData(content);
    setActiveTab("editor");
  };

  const handleDelete = async (id: string) => {
    try {
      await api.cms.delete(id);
      setContents(contents.filter((c) => c.id !== id));
      toast.success(t("cms_deleted"));
    } catch (e: any) {
      toast.error(t("cms_delete_failed") + ": " + (e.message || ""));
    }
  };

  const filteredContents = contents.filter((c) => c.category === activeTab);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("cms_title")}</h1>
        <p className="text-muted-foreground">{t("cms_subtitle")}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="blog">{t("cms_blog")}</TabsTrigger>
          <TabsTrigger value="announcement">{t("cms_announcement")}</TabsTrigger>
          <TabsTrigger value="help">{t("cms_help")}</TabsTrigger>
          <TabsTrigger value="faq">{t("cms_faq")}</TabsTrigger>
        </TabsList>

        {/* Content List Views */}
        {["blog", "announcement", "help", "faq"].map((category) => (
          <TabsContent key={category} value={category} className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold capitalize">
                {catLabel(category)}
              </h2>
              <Button
                onClick={() => {
                  setFormData({ category: category as any });
                  setActiveTab("editor");
                }}
                className="bg-gradient-to-r from-emerald-600 to-cyan-600"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t("cms_new")} {catLabel(category)}
              </Button>
            </div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid gap-4"
            >
              {loading ? (
                <Card className="p-8 text-center text-muted-foreground">
                  {t("cms_loading")}
                </Card>
              ) : filteredContents.length === 0 ? (
                <Card className="p-8 text-center text-muted-foreground">
                  {t("cms_none_prefix")} {catLabel(category)} {t("cms_none_suffix")}
                </Card>
              ) : (
                filteredContents.map((content) => (
                  <motion.div key={content.id} variants={itemVariants}>
                    <Card className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="flex items-center gap-2">
                              {content.title}
                              <Badge
                                variant={
                                  content.status === "published"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {content.status === "published" ? t("cms_published_status") : t("cms_draft")}
                              </Badge>
                            </CardTitle>
                            <CardDescription className="mt-2">
                              {content.excerpt ||
                                content.content.substring(0, 100) + "..."}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(content)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            {t("edit")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            {t("cms_preview")}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(content.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t("delete")}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              )}
            </motion.div>
          </TabsContent>
        ))}

        {/* Editor Tab */}
        <TabsContent value="editor" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {editingId ? t("cms_edit_content") : t("cms_create_new")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">{t("cms_title_star")}</Label>
                  <Input
                    id="title"
                    value={formData.title || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder={t("cms_content_title")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">{t("cms_slug")}</Label>
                  <Input
                    id="slug"
                    value={formData.slug || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, slug: e.target.value })
                    }
                    placeholder="content-slug"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">{t("cms_category")}</Label>
                  <select
                    id="category"
                    value={formData.category || "blog"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        category: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  >
                    <option value="blog">{t("cms_blog")}</option>
                    <option value="announcement">{t("cms_announcement")}</option>
                    <option value="help">{t("cms_help")}</option>
                    <option value="faq">{t("cms_faq")}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">{t("status")}</Label>
                  <select
                    id="status"
                    value={formData.status || "draft"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  >
                    <option value="draft">{t("cms_draft")}</option>
                    <option value="published">{t("cms_published_status")}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="excerpt">{t("cms_excerpt")}</Label>
                <Textarea
                  id="excerpt"
                  value={formData.excerpt || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, excerpt: e.target.value })
                  }
                  placeholder={t("cms_excerpt_ph")}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">{t("cms_content_star")}</Label>
                <Textarea
                  id="content"
                  value={formData.content || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, content: e.target.value })
                  }
                  placeholder={t("cms_content_ph")}
                  rows={8}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingId(null);
                    setFormData({
                      title: "",
                      slug: "",
                      content: "",
                      category: "blog",
                      status: "draft",
                      author: "Admin",
                      excerpt: "",
                    });
                    setActiveTab("blog");
                  }}
                >
                  {t("cancel")}
                </Button>
                <Button
                  onClick={handleAdd}
                  disabled={saving}
                  className="bg-gradient-to-r from-emerald-600 to-cyan-600"
                >
                  {saving ? t("saving") : editingId ? t("cms_update_content") : t("cms_create_content")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CMS;
