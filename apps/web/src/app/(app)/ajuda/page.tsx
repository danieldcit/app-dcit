import { getLocale } from "@/lib/get-locale";
import { requireSession } from "@/lib/session";
import { translate } from "@/translations/dictionaries";

import { getFaqCategories } from "./faq-content";
import styles from "./ajuda.module.css";

export default async function AjudaPage() {
  const [user, locale] = await Promise.all([requireSession(), getLocale()]);
  const t = (source: string) => translate(locale, source);
  const allCategories = await getFaqCategories(locale);
  const categories = allCategories.filter(
    (category) => !category.roles || category.roles.includes(user.role),
  );

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>{t("Central de Ajuda")}</h1>
      <p className={styles.intro}>
        {t(
          "Dúvidas comuns sobre como usar o SGP. Se não encontrar o que procura aqui, fale com seu gestor ou com o RH.",
        )}
      </p>
      {categories.map((category) => (
        <section key={category.title} className={styles.category}>
          <h2 className={styles.categoryTitle}>{category.title}</h2>
          <div className={styles.items}>
            {category.items.map((item) => (
              <details key={item.question} className={styles.item}>
                <summary className={styles.question}>{item.question}</summary>
                <p className={styles.answer}>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
