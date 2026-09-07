# Paridade de Onboarding no Mobile + Barra de Abas Expansível

**Status:** Proposto
**Specs relacionadas:**
[`2026-09-05-document-review-onboarding-upload-design.md`](2026-09-05-document-review-onboarding-upload-design.md) (onboarding do colaborador na web, upload embutido),
[`2026-09-07-onboarding-access-gating-design.md`](2026-09-07-onboarding-access-gating-design.md) (gate de acesso na web — nota: aquela spec descreve um modelo de auto-liberação ao completar a trilha que foi implementado e depois **revertido**; o comportamento atual, usado como base aqui, é o do código hoje em `apps/api/src/onboarding/onboarding.service.ts`: acesso total só é concedido por ação manual de gestor/rh via `grantFullAccess`, nunca automaticamente).

## 1. Objetivo e escopo

Pedido do usuário (2026-09-07): "toda experiência que está na web tem que estar no mobile" — regra de paridade permanente (ver memória `feedback_web-mobile-feature-parity`). Auditoria (agente Explore, 2026-09-07) encontrou o onboarding do colaborador como o maior gap: o mobile só implementa a tarefa de upload de documentos admissionais; faltam vídeo de boas-vindas, "Conhecer o time", assinatura de contrato, checklist de acessos, os diálogos de conclusão/liberação, a visão do gestor/RH sobre a equipe, e o próprio bloqueio de navegação para quem não está liberado. O backend já expõe tudo isso (`OnboardingController`, `DocumentosController`) — **este é um projeto 100% de frontend mobile, sem mudanças de API ou banco**.

Durante o brainstorming, o usuário pediu também uma mudança de navegação: adicionar Onboarding e Notificações como destinos rápidos na barra de abas inferior, sem remover os 5 ícones atuais, usando uma seta acima do ícone de Férias que expande a barra para revelar os dois novos atalhos.

Decisões tomadas em conversa:
- Escopo único (um spec, não quatro) cobrindo: tarefas de onboarding do colaborador, gate de navegação, visão do gestor/RH, aba "Contrato" em Documentos, e a barra de abas expansível.
- Vídeo de boas-vindas: paridade completa com a web, incluindo retomar de onde parou e bloqueio de avanço (anti-skip) — não uma versão simplificada.
- Upload do contrato assinado: adicionar `expo-document-picker` (nova dependência) para selecionar PDF, replicando o input de arquivo da web.
- Gate de navegação: verificação client-side (Expo Router não tem middleware de servidor) no foco do grupo de abas — fail-open em erro/timeout, igual à web.
- Barra de abas: Opção A — a barra cresce para cima quando a seta é tocada, revelando uma fileira extra com Onboarding e Notificações; os 5 ícones atuais não mudam de lugar.

## 2. Novas dependências (`apps/mobile/package.json`)

- `react-native-webview` — reproduzir o YouTube IFrame API embutido (vídeo de boas-vindas).
- `expo-document-picker` — selecionar o PDF do contrato assinado (mobile só tem `expo-image-picker` hoje, que não serve para arquivos arbitrários).
- `@react-native-async-storage/async-storage` — persistir o progresso do vídeo (equivalente ao `localStorage` usado pela web), **caso ainda não esteja instalado** (verificar antes de adicionar; várias libs do Expo já o trazem transitivamente).

Nenhuma dependência nova de UI/animação — a barra expansível usa a API `Animated` do próprio `react-native`.

## 3. Camada de dados (`apps/mobile/src/lib/`)

### 3.1 `onboarding-api.ts` (modificado)

`OnboardingTaskRecord` ganha os campos que já vêm do backend mas não são lidos hoje:

```typescript
export type OnboardingTaskRecord = {
  id: string;
  icon: string;
  title: string;
  description: string;
  order: number;
  requiresUpload: boolean;
  requiresVideo: boolean;
  showsTeam: boolean;
  requiresContract: boolean;
  requiresAccessChecklist: boolean;
};
```

`OnboardingTasksResponse` ganha `completedAccessItems: string[]` e `fullAccessGrantedAt: string | null` (o type guard `isOnboardingTasksResponse` não precisa validar os campos novos — mesma tolerância que o resto do arquivo já tem para campos opcionais).

Novas funções, seguindo o padrão `authedFetch` já existente no arquivo:

```typescript
export async function fetchOnboardingStatus(token: string): Promise<{ unlocked: boolean } | null> {
  try {
    const response = await authedFetch(token, "/onboarding/meu-status");
    if (!response.ok) return null;
    return (await response.json()) as { unlocked: boolean };
  } catch {
    return null;
  }
}

export async function toggleOnboardingAccessItem(
  token: string,
  item: string,
): Promise<{ completed: boolean } | null> {
  try {
    const response = await authedFetch(token, `/onboarding/acessos/${item}/toggle`, { method: "POST" });
    if (!response.ok) return null;
    return (await response.json()) as { completed: boolean };
  } catch {
    return null;
  }
}

export type TeamOnboardingProgress = {
  userId: string;
  userName: string;
  completedCount: number;
  totalCount: number;
  tasks: OnboardingTaskRecord[];
  completedTaskIds: string[];
  fullAccessGrantedAt: string | null;
  fullAccessGrantSource: string | null;
  fullAccessGrantedByName: string | null;
};

export async function fetchTeamOnboardingProgress(token: string): Promise<TeamOnboardingProgress[] | null> {
  try {
    const response = await authedFetch(token, "/onboarding/equipe");
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return Array.isArray(data) ? (data as TeamOnboardingProgress[]) : null;
  } catch {
    return null;
  }
}

export async function grantOnboardingFullAccess(
  token: string,
  userId: string,
): Promise<{ grantedAt: string; source: string; grantedByName: string | null } | null> {
  try {
    const response = await authedFetch(token, `/onboarding/equipe/${userId}/liberar-acesso`, { method: "POST" });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}
```

Importa `ONBOARDING_ACCESS_ITEMS`/`ONBOARDING_ACCESS_ITEM_LABELS` de `@ponto-dcit/shared-types` e reexporta, mesmo padrão de `ADMISSION_DOCUMENT_KINDS` em `documentos-api.ts`.

### 3.2 `documentos-api.ts` (modificado)

```typescript
export type SignedContractRecord = { submittedAt: string | null };

export async function fetchSignedContract(token: string): Promise<SignedContractRecord | null> {
  try {
    const response = await authedFetch(token, "/documentos/contrato");
    if (!response.ok) return null;
    return (await response.json()) as SignedContractRecord;
  } catch {
    return null;
  }
}

export async function submitSignedContract(
  token: string,
  fileDataUrl: string,
): Promise<{ submittedAt: string } | null> {
  try {
    const response = await authedFetch(token, "/documentos/contrato", {
      method: "POST",
      body: JSON.stringify({ fileDataUrl }),
    });
    if (!response.ok) return null;
    return (await response.json()) as { submittedAt: string };
  } catch {
    return null;
  }
}
```

## 4. Tela de onboarding do colaborador

### 4.1 `components/welcome-video-player.tsx` (novo)

`WebView` (`react-native-webview`) carregando uma string HTML local (`source={{ html }}`, não uma URL) que embute o YouTube IFrame API — mesma abordagem da web (`loadYouTubeApi`/`YT.Player`), mas hospedada dentro do HTML injetado em vez de depender do `document` do navegador:

```typescript
const VIDEO_ID = "9US-Rv6-354"; // mesmo vídeo da web (apps/web/.../welcome-video-player.tsx)
const PROGRESS_STORAGE_KEY = `onboarding-video-progress:${VIDEO_ID}`;

const PLAYER_HTML = `
<!DOCTYPE html><html><body style="margin:0">
  <div id="player"></div>
  <script src="https://www.youtube.com/iframe_api"></script>
  <script>
    var player, maxWatched = ${/* injetado via injectedJavaScriptBeforeContentLoaded, ver abaixo */ 0};
    function onYouTubeIframeAPIReady() {
      player = new YT.Player('player', {
        videoId: '${VIDEO_ID}',
        playerVars: { modestbranding: 1, rel: 0 },
        events: {
          onReady: function() {
            if (maxWatched > 1.5) player.seekTo(maxWatched, true);
            setInterval(function() {
              var current = player.getCurrentTime();
              if (current > maxWatched + 1.5) {
                player.seekTo(maxWatched, true);
              } else {
                maxWatched = Math.max(maxWatched, current);
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'progress', seconds: maxWatched }));
              }
            }, 500);
          },
          onStateChange: function(event) {
            if (event.data === YT.PlayerState.ENDED) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ended' }));
            }
          }
        }
      });
    }
  </script>
</body></html>`;
```

Componente:

```typescript
export function WelcomeVideoPlayer({ onCompleted }: { onCompleted: () => void }) {
  const [initialProgress, setInitialProgress] = useState<number | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(PROGRESS_STORAGE_KEY).then((value) => setInitialProgress(Number(value) || 0));
  }, []);

  if (initialProgress === null) return <ActivityIndicator />; // aguarda ler o AsyncStorage antes de montar a WebView

  function handleMessage(event: WebViewMessageEvent) {
    const data = JSON.parse(event.nativeEvent.data) as { type: string; seconds?: number };
    if (data.type === "progress" && data.seconds !== undefined) {
      AsyncStorage.setItem(PROGRESS_STORAGE_KEY, String(data.seconds));
    } else if (data.type === "ended") {
      AsyncStorage.removeItem(PROGRESS_STORAGE_KEY);
      onCompleted();
    }
  }

  return (
    <View style={styles.videoWrapper}>
      <WebView
        source={{ html: PLAYER_HTML.replace("/* injetado */ 0", String(initialProgress)) }}
        onMessage={handleMessage}
        javaScriptEnabled
        style={styles.webview}
      />
    </View>
  );
}
```

Mesma lógica de retomar (`seekTo` no `onReady`) e anti-skip (polling a cada 500ms comparando `getCurrentTime()` contra o máximo já assistido) que a web, só que o estado (`maxWatched`) vive dentro da página carregada na WebView e é sincronizado para o `AsyncStorage` via `postMessage` em vez de `window.localStorage` direto — a WebView do RN não expõe o `localStorage` do app React Native, só o da própria página carregada, que não persiste de forma confiável entre remontagens do componente.

### 4.2 `components/team-section.tsx` + `lib/team-members.ts` + `assets/images/team/*.jpg` (novos)

Copiar os 14 arquivos de `apps/web/public/team/*.jpg` (~440KB total) para `apps/mobile/src/assets/images/team/`. `lib/team-members.ts` replica `TEAM_ROWS` da web trocando `image: "/team/xxx.jpg"` por `image: require("@/assets/images/team/xxx.jpg")`. `TeamSection` renderiza a mesma grade (nome + cargo + foto) com `expo-image`, e um botão "Marcar como concluído" / "Desfazer" (`ThemedButton`) — comportamento manual idêntico à web, sem detecção automática.

### 4.3 `components/contract-box.tsx` (novo, compartilhado entre Onboarding e Documentos)

```typescript
export function ContractBox({
  existing,
  onSubmitted,
}: {
  existing: SignedContractRecord | null;
  onSubmitted?: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  async function handlePickAndSubmit() {
    const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf" });
    if (result.canceled) return;
    const token = await getSessionToken();
    if (!token) return;
    setSubmitting(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: "base64" });
      const submitted = await submitSignedContract(token, `data:application/pdf;base64,${base64}`);
      if (submitted) onSubmitted?.();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.form}>
      <ThemedText type="smallBold">Contrato de trabalho</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {existing?.submittedAt
          ? `Enviado em ${new Date(existing.submittedAt).toLocaleDateString("pt-BR")}`
          : "Nenhum contrato assinado enviado ainda."}
      </ThemedText>
      <Pressable onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/../documents/contrato-modelo.pdf`)}>
        <ThemedText type="small" themeColor="secondary">Baixar modelo do contrato</ThemedText>
      </Pressable>
      <ThemedButton
        title={submitting ? "Enviando..." : existing?.submittedAt ? "Reenviar" : "Enviar PDF assinado"}
        onPress={submitting ? () => {} : handlePickAndSubmit}
      />
    </View>
  );
}
```

Nota: o link do modelo do contrato hoje é servido como asset estático do Next (`apps/web/public/documents/contrato-modelo.pdf`), não pela API — a URL exata a usar (host do web app, não `API_URL`) precisa ser confirmada durante a implementação; se não houver uma constante de URL do web app configurada no mobile, adicionar `EXPO_PUBLIC_WEB_APP_URL` ao `.env` do mobile (mesmo padrão de `EXPO_PUBLIC_API_URL`).

### 4.4 `components/access-checklist-section.tsx` (novo)

Lista simples de `ONBOARDING_ACCESS_ITEMS`, cada item com seu próprio botão de toggle (`Pendente`/`Concluído`), chamando `toggleOnboardingAccessItem` — mesma estrutura "cada item independente" da web, sem ação separada de "concluir a tarefa" (é derivado no backend quando todos os itens estão feitos, igual à web).

### 4.5 `app/onboarding.tsx` (modificado)

- Passa a buscar também `fetchSignedContract` (além de `fetchOnboardingTasks`/`fetchAdmissionDocuments`) quando `role === "colaborador"`.
- Cada tarefa expandida renderiza a seção certa conforme as novas flags (`requiresVideo` → `WelcomeVideoPlayer`, `showsTeam` → `TeamSection`, `requiresContract` → `ContractBox`, `requiresAccessChecklist` → `AccessChecklistSection`), mesma ramificação condicional que `colaborador-onboarding.tsx` já faz na web.
- Dois modais novos (`Modal` do RN, `transparent visible={...}`), replicando a lógica de transição da web via `useRef`/`useEffect` comparando o valor anterior de `isComplete` e de `fullAccessGrantedAt`:
  - "🎉 Parabéns! Onboarding concluído" — aparece quando todas as tarefas passam a estar completas e ainda não há `fullAccessGrantedAt`.
  - "🎉 Acesso liberado!" — aparece quando `fullAccessGrantedAt` passa de `null` para um valor; botão "Ir para o Dashboard" faz `router.replace("/(tabs)")`.
- Se `role !== "colaborador"`, a tela renderiza a visão do gestor/RH (§6) em vez da lista de tarefas — mesma ramificação por papel que `apps/web/.../onboarding/page.tsx` já faz num único arquivo.

## 5. Aba "Contrato" em Documentos (`app/(tabs)/documentos.tsx`)

- `Category` ganha `"contrato"`; `CATEGORIES` ganha `{ key: "contrato", label: "Contrato" }`.
- Nova função `ContratoSection()` no mesmo arquivo (mesmo padrão de `AdmissionaisSection`/`CertificacoesSection`): busca `fetchSignedContract` no `useFocusEffect`, renderiza `<ContractBox existing={...} onSubmitted={...} />` sem o `onSubmitted` de auto-completar tarefa (esse comportamento só se aplica dentro do embed de Onboarding).

## 6. Gate de onboarding (`app/(tabs)/_layout.tsx`)

Sem middleware de servidor no Expo Router — a checagem roda no cliente, no foco do grupo de abas (do ponto de vista do `Stack` raiz, `(tabs)` é uma única tela, então `useFocusEffect` dispara toda vez que se navega para `/(tabs)`, inclusive vindo de `/onboarding`):

```typescript
export default function TabsLayout() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setChecking(true);
      (async () => {
        const token = await getSessionToken();
        if (!token) return;
        const claims = decodeSessionToken(token);
        if (claims?.role !== "colaborador") {
          if (!cancelled) setChecking(false);
          return;
        }
        const status = await fetchOnboardingStatus(token); // null (erro/timeout) => fail-open, mesmo espírito da web
        if (cancelled) return;
        if (status && !status.unlocked) {
          router.replace("/onboarding");
          return;
        }
        setChecking(false);
      })();
      return () => {
        cancelled = true;
      };
    }, [router]),
  );

  if (checking) return <FullScreenLoading />; // evita flash das abas antes da 1ª checagem resolver

  return <Tabs tabBar={(props) => <ExpandableTabBar {...props} />}>{/* ...Tabs.Screen atuais... */}</Tabs>;
}
```

`fetchOnboardingStatus` já retorna `null` em qualquer erro/exceção (mesmo padrão fail-open de todas as outras funções de `lib/*-api.ts`), então não precisa de um `AbortSignal.timeout` explícito feito à mão — o `fetch` sem timeout configurado nunca trava a UI indefinidamente de um jeito diferente das outras chamadas já existentes no app; se isso se mostrar um problema real em teste manual, adicionar timeout na implementação.

## 7. Visão do gestor/RH

### 7.1 `app/onboarding.tsx`, ramo gestor/rh

Busca `fetchTeamOnboardingProgress` em vez de `fetchOnboardingTasks`; renderiza uma lista (`FlatList` ou `.map` dentro de `ScrollView`, mesmo padrão das outras telas) com nome, "X de Y tarefas", barra de progresso; cada linha navega (`router.push`) para `/onboarding-detalhe?userId=...`.

### 7.2 `app/onboarding-detalhe.tsx` (novo, modal)

```typescript
export const unstable_settings = { presentation: "modal" }; // ou configurado via <Stack.Screen options={{ presentation: "modal" }} /> no _layout raiz
```

Recebe `userId` via `useLocalSearchParams`, busca `fetchTeamOnboardingProgress` de novo e filtra pelo `userId` (lista pequena — organização inteira — refetch é mais simples que passar o objeto inteiro serializado como param). Renderiza a lista de tarefas com status, e o botão "Liberar acesso total ao SGP Portal":
- Label dinâmico igual à web (`grantLabel`): "Liberar acesso total ao SGP Portal" / "Liberado manualmente por {nome}" / "Acesso liberado automaticamente".
- `disabled` apenas se já existe `fullAccessGrantedAt` ou uma chamada em andamento — nunca por trilha incompleta (mesmo comportamento pós-reversão do auto-unlock, ver nota no topo do documento).
- Confirmação via `Alert.alert` com botão "Cancelar"/"Confirmar liberação" antes de chamar `grantOnboardingFullAccess`, com o mesmo texto de aviso da web quando a trilha está incompleta.

## 8. Barra de abas expansível (`components/expandable-tab-bar.tsx`, novo)

Usado como prop `tabBar` do `<Tabs>` em `(tabs)/_layout.tsx`, recebendo `BottomTabBarProps` (`state`, `descriptors`, `navigation`) do `@react-navigation/bottom-tabs` por baixo do Expo Router.

```typescript
export function ExpandableTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const router = useRouter();
  const { unreadCount } = useNotificationContext();
  const [expanded, setExpanded] = useState(false);
  const heightAnim = useRef(new Animated.Value(0)).current;

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    Animated.timing(heightAnim, { toValue: next ? 1 : 0, duration: 200, useNativeDriver: false }).start();
  }

  function goToShortcut(path: "/onboarding" | "/notificacoes") {
    setExpanded(false);
    Animated.timing(heightAnim, { toValue: 0, duration: 150, useNativeDriver: false }).start();
    router.push(path);
  }

  return (
    <View style={styles.wrapper}>
      <Animated.View
        style={[
          styles.extraRow,
          { backgroundColor: theme.backgroundElement, height: heightAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 64] }) },
        ]}
      >
        <Pressable style={styles.extraItem} onPress={() => goToShortcut("/onboarding")}>
          <Ionicons name="rocket-outline" size={22} color={theme.textSecondary} />
          <ThemedText type="small">Onboarding</ThemedText>
        </Pressable>
        <Pressable style={styles.extraItem} onPress={() => goToShortcut("/notificacoes")}>
          <View>
            <Ionicons name="notifications-outline" size={22} color={theme.textSecondary} />
            {unreadCount > 0 ? <View style={styles.badge} /> : null}
          </View>
          <ThemedText type="small">Notificações</ThemedText>
        </Pressable>
      </Animated.View>

      <View style={[styles.mainRow, { backgroundColor: theme.backgroundElement }]}>
        <Pressable style={styles.expandHandle} onPress={toggle} accessibilityLabel="Mais opções">
          <Ionicons name={expanded ? "chevron-down" : "chevron-up"} size={16} color={theme.textSecondary} />
        </Pressable>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          return (
            <Pressable
              key={route.key}
              style={styles.tabItem}
              onPress={() => navigation.navigate(route.name)}
            >
              {options.tabBarIcon?.({ focused, color: focused ? theme.secondary : theme.textSecondary, size: 24 })}
              <ThemedText type="small">{String(options.title)}</ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
```

Pontos de design:
- `expandHandle` é posicionado via `position: "absolute"`, `top: -14`, centralizado horizontalmente sobre o índice do ícone de Férias (`left: "40%"` aproximado, ou calculado a partir da largura de tela dividida por 5 tabs — ajustar durante implementação para ficar visualmente centrado).
- A fileira extra (`extraRow`) fica **acima** da `mainRow` no layout (`flexDirection: "column"`, `extraRow` primeiro), crescendo de altura 0 até 64 — dá a sensação de "a barra cresce para cima", como decidido.
- Tocar num atalho da fileira extra recolhe a animação e navega — não se torna uma aba "ativa" com estado persistente (Onboarding e Notificações continuam sendo rotas de `Stack`, fora do grupo `(tabs)`, então não têm um `state.index` para destacar).
- Reusa `useNotificationContext` (já usado em `(tabs)/index.tsx`) para o badge de não lidas, sem duplicar lógica de contagem.

## 9. Testes

Seguindo TDD e os padrões já usados em `apps/mobile/src/__tests__` (`@testing-library/react-native`, `renderRouter` para telas do Expo Router):

- `lib/onboarding-api.test.ts`: cada nova função (`fetchOnboardingStatus`, `toggleOnboardingAccessItem`, `fetchTeamOnboardingProgress`, `grantOnboardingFullAccess`) — sucesso, resposta não-ok, exceção de rede (mesmo padrão dos testes existentes de `fetchOnboardingTasks`).
- `lib/documentos-api.test.ts`: `fetchSignedContract`/`submitSignedContract`, mesmo padrão.
- `components/welcome-video-player.test.tsx`: mocka `react-native-webview` e `AsyncStorage`; verifica que a mensagem `{type: "ended"}` chama `onCompleted` e limpa o `AsyncStorage`; que uma mensagem `{type: "progress"}` grava no `AsyncStorage`; que o progresso salvo é lido antes de montar a WebView (não deve chamar `onCompleted` sozinho).
- `components/team-section.test.tsx`, `components/contract-box.test.tsx`, `components/access-checklist-section.test.tsx`: render + interações (toggle, submit) mockando as funções de `lib/*`.
- `app/__tests__/app/onboarding.test.tsx` (estendido): colaborador vê as 4 novas tarefas conforme as flags; completar a última tarefa mostra o modal de parabéns; `fullAccessGrantedAt` passando de `null` para valor mostra o modal de liberação; gestor/rh vê a lista de progresso da equipe em vez das tarefas.
- `app/__tests__/app/onboarding-detalhe.test.tsx` (novo): renderiza tarefas do colaborador selecionado; botão de liberar chama `grantOnboardingFullAccess` após confirmação; label muda conforme `fullAccessGrantSource`.
- `app/__tests__/app/(tabs)/_layout.test.tsx` (novo ou estendido): colaborador com `unlocked: false` é redirecionado para `/onboarding` ao focar `(tabs)`; colaborador liberado e qualquer gestor/rh veem as abas normalmente; erro na chamada de status não bloqueia (fail-open).
- `components/expandable-tab-bar.test.tsx` (novo): os 5 ícones atuais sempre renderizam; tocar na seta expande e mostra Onboarding/Notificações; tocar num atalho navega para a rota certa e recolhe a fileira extra.

## 10. Global Constraints

- Nenhuma mudança em `apps/api` ou no schema do Prisma — todos os endpoints usados já existem e já são consumidos pela web.
- Onboarding e Notificações continuam como rotas de `Stack` fora do grupo `(tabs)` — a barra expansível é só uma forma de navegação mais rápida até elas, não uma reestruturação de rotas (evita quebrar os lugares que já linkam pra `/onboarding` e `/notificacoes`: `perfil.tsx`, `busca.tsx`, o sino em `(tabs)/index.tsx`).
- O gate de onboarding no mobile é fail-open (igual à web): qualquer erro, timeout ou resposta inesperada de `/onboarding/meu-status` resulta em `unlocked` tratado como verdadeiro — nunca trava o app inteiro por uma falha de rede.
- Só `colaborador` passa pelo gate; `gestor`/`rh` nunca são redirecionados para `/onboarding` à força (podem visitar a tela livremente pelo menu Perfil, como hoje).
- Acesso total nunca é concedido automaticamente (nem no mobile, nem na web) — é sempre uma ação manual de gestor/rh via `grantFullAccess`, refletindo o estado atual do backend (pós-reversão do auto-unlock).

## 11. Fora de escopo

- Qualquer mudança no backend (`apps/api`) — endpoints e regras de negócio já existem e não mudam.
- Gate de onboarding aplicado a rotas de `Stack` fora do grupo `(tabs)` (ex.: acessar `/folha` ou `/historico` diretamente por deep link enquanto restrito) — a auditoria não encontrou esse caminho como uso real hoje (essas telas só são alcançadas a partir de dentro das abas), e replicar o nível de rigor do middleware da web exigiria interceptar todo o `Stack` raiz; revisitar se surgir um caso real de deep link.
- Adicionar Benefícios/Operacional (hoje só no menu Perfil) à fileira expansível — o pedido foi especificamente Onboarding e Notificações.
- Revogar um acesso já liberado — não existe "desliberar" nem na web nem aqui.
- Otimizar a chamada duplicada de `/onboarding/meu-status` (uma no gate do `(tabs)/_layout.tsx`, outra dentro da própria tela de onboarding via `fullAccessGrantedAt` de `/onboarding/tarefas`) — mesma decisão de manter simples que a spec da web já tomou.
