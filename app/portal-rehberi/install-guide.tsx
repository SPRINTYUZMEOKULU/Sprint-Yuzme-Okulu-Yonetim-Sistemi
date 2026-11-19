import Link from "next/link";
import "./install-guide.css";

const platforms = [
  {
    name: "iPhone · Safari",
    steps: [
      ["↗", "Safari’de aç", "Giriş bağlantısını Safari’de açın. WhatsApp içinde açıldıysa bağlantıyı kopyalayıp Safari’ye yapıştırın."],
      ["↑", "Paylaş", "Sayfa menüsünden Paylaş’a dokunun. Paylaş düğmesi doğrudan görünüyorsa onu kullanın."],
      ["+", "Ana Ekrana Ekle", "Listede Ana Ekrana Ekle’yi seçin. Web uygulaması olarak aç seçeneği görünüyorsa etkinleştirin ve Ekle’ye dokunun."],
    ],
  },
  {
    name: "Android · Chrome",
    steps: [
      ["↗", "Chrome’da aç", "Giriş bağlantısını Chrome’da açın. WhatsApp içinde açıldıysa bağlantıyı kopyalayıp Chrome’a yapıştırın."],
      ["⋮", "Üç nokta menüsü", "Adres çubuğunun yanındaki üç noktaya dokunun."],
      ["+", "Uygulamayı yükle", "Uygulamayı yükle veya Ana ekrana ekle seçeneğini açın ve işlemi onaylayın. Menü adı telefonunuza göre değişebilir."],
    ],
  },
];

export default function InstallGuide() {
  return <section className="installGuide" id="telefona-ekle" aria-labelledby="install-title">
    <header>
      <h2 id="install-title">SPRINT’i telefonunuza ekleyin</h2>
      <p>Portalı Safari veya Chrome’dan ana ekranınıza ekleyebilirsiniz. Mağazadan indirme gerekmez.</p>
      <Link href="/login" className="portalGuidePrimary">Giriş Sayfasını Aç</Link>
    </header>
    {platforms.map(platform => <div className="installPlatform" key={platform.name}>
      <h3>{platform.name}</h3>
      <ol className="installSteps">
        {platform.steps.map(([icon, title, description], index) => <li key={title}>
          <div className="installIllustration" aria-hidden="true">
            <span className="installStepNumber">{index + 1}</span>
            <span className="installScreen"><span>{icon}</span>{title}</span>
          </div>
          <h4>{title}</h4>
          <p>{description}</p>
        </li>)}
      </ol>
    </div>)}
    <div className="installFollow">
      <img src="/icons/apple-touch-icon.png?v=10" alt="" width="54" height="54" loading="lazy"/>
      <div><h3>Her gün SPRINT simgesinden takip edin</h3>
      <p>Ana ekranınızdaki SPRINT simgesine dokunun ve mevcut hesabınızla giriş yapın. Ders programınız, yoklamalarınız, telafileriniz ve ödeme bilgileriniz aynı hesapta görünür.</p></div>
    </div>
  </section>;
}
