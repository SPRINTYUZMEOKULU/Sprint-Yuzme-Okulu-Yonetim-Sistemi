<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ana Sayfa | SprintOS</title>
    <!-- Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    
    <!-- Font Awesome (İkonlar) -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    
    <!-- Google Fonts: Inter -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: { sans: ['Inter', 'sans-serif'] },
                    colors: {
                        brand: { 50: '#f0f9ff', 100: '#e0f2fe', 500: '#0ea5e9', 600: '#0284c7', 900: '#0c4a6e' },
                        navy: { 800: '#1e293b', 900: '#0f172a' }
                    }
                }
            }
        }
    </script>
    <style>
        body { background-color: #f8fafc; font-family: 'Inter', sans-serif; }
        
        .sidebar-transition { transition: transform 0.3s ease-in-out; }
        
        .glass-card {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(226, 232, 240, 0.8);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
            border-radius: 1rem;
        }

        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        
        .nav-item-active {
            background-color: rgba(14, 165, 233, 0.1);
            color: #0ea5e9;
        }
        .nav-item-active::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 4px;
            background-color: #0ea5e9;
            border-top-right-radius: 9999px;
            border-bottom-right-radius: 9999px;
        }
    </style>
</head>

<body class="text-slate-800 antialiased h-screen flex overflow-hidden">

    <div id="mobile-overlay" class="fixed inset-0 bg-navy-900/50 z-40 hidden lg:hidden transition-opacity duration-300 opacity-0" onclick="toggleMenu()"></div>

    <aside id="sidebar" class="sidebar-transition fixed lg:static inset-y-0 left-0 z-50 w-72 bg-navy-900 text-white flex flex-col h-full overflow-y-auto transform -translate-x-full lg:translate-x-0">
        
        <!-- Logo -->
        <div class="p-6 flex items-center gap-4 border-b border-white/10 sticky top-0 bg-navy-900 z-10">
            <div class="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg p-1 shrink-0">
                <i class="fa-solid fa-water text-brand-500 text-2xl"></i>
            </div>
            <div class="min-w-0">
                <h1 class="text-xl font-bold tracking-tight text-white truncate">SprintOS</h1>
                <p class="text-xs text-brand-100/70 uppercase tracking-wider font-semibold truncate">Yüzme Okulu Yönetimi</p>
            </div>
        </div>

        <!-- Menü Grupları -->
        <nav class="flex-1 px-4 py-6 space-y-8">
            
            <!-- Grup: GENEL -->
            <div>
                <p class="px-3 text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">Genel</p>
                <div class="space-y-1">
                    <a href="#" class="nav-item-active flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors relative">
                        <i class="fa-solid fa-house w-5 text-center"></i>
                        <span>Ana Sayfa</span>
                    </a>
                    <a href="#" class="flex items-center gap-3 px-3 py-2.5 text-white/70 hover:text-white hover:bg-white/5 rounded-lg font-medium transition-colors">
                        <i class="fa-solid fa-file-signature w-5 text-center"></i>
                        <span>Ön Kayıtlar</span>
                        <span class="ml-auto bg-orange-500/20 text-orange-400 py-0.5 px-2 rounded-full text-xs font-bold">12</span>
                    </a>
                    <a href="#" class="flex items-center gap-3 px-3 py-2.5 text-white/70 hover:text-white hover:bg-white/5 rounded-lg font-medium transition-colors">
                        <i class="fa-solid fa-child-reaching w-5 text-center"></i>
                        <span>Öğrenciler</span>
                    </a>
                    <a href="#" class="flex items-center gap-3 px-3 py-2.5 text-white/70 hover:text-white hover:bg-white/5 rounded-lg font-medium transition-colors">
                        <i class="fa-solid fa-users w-5 text-center"></i>
                        <span>Veliler</span>
                    </a>
                </div>
            </div>

            <div>
                <p class="px-3 text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">Eğitim</p>
                <div class="space-y-1">
                    <a href="#" class="flex items-center gap-3 px-3 py-2.5 text-white/70 hover:text-white hover:bg-white/5 rounded-lg font-medium transition-colors">
                        <i class="fa-solid fa-building w-5 text-center"></i>
                        <span>Şubeler</span>
                    </a>
                     <a href="#" class="flex items-center gap-3 px-3 py-2.5 text-white/70 hover:text-white hover:bg-white/5 rounded-lg font-medium transition-colors">
                        <i class="fa-solid fa-layer-group w-5 text-center"></i>
                        <span>Gruplar</span>
                    </a>
                    <a href="#" class="flex items-center gap-3 px-3 py-2.5 text-white/70 hover:text-white hover:bg-white/5 rounded-lg font-medium transition-colors">
                        <i class="fa-regular fa-calendar-days w-5 text-center"></i>
                        <span>Ders Programı</span>
                    </a>
                    <a href="#" class="flex items-center gap-3 px-3 py-2.5 text-white/70 hover:text-white hover:bg-white/5 rounded-lg font-medium transition-colors">
                        <i class="fa-solid fa-check-double w-5 text-center"></i>
                        <span>Yoklama</span>
                    </a>
                </div>
            </div>
            
             <div>
                <p class="px-3 text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">Finans & Yönetim</p>
                <div class="space-y-1">
                    <a href="#" class="flex items-center gap-3 px-3 py-2.5 text-white/70 hover:text-white hover:bg-white/5 rounded-lg font-medium transition-colors">
                        <i class="fa-solid fa-wallet w-5 text-center"></i>
                        <span>Günlük Kasa</span>
                        <span class="ml-auto bg-purple-500/20 text-purple-400 py-0.5 px-2 rounded-full text-xs font-bold">3</span>
                    </a>
                    <a href="#" class="flex items-center gap-3 px-3 py-2.5 text-white/70 hover:text-white hover:bg-white/5 rounded-lg font-medium transition-colors">
                        <i class="fa-regular fa-bell w-5 text-center"></i>
                        <span>Uyarılar</span>
                        <span class="ml-auto bg-red-500/20 text-red-400 py-0.5 px-2 rounded-full text-xs font-bold">2</span>
                    </a>
                     <a href="#" class="flex items-center gap-3 px-3 py-2.5 text-white/70 hover:text-white hover:bg-white/5 rounded-lg font-medium transition-colors">
                        <i class="fa-solid fa-gear w-5 text-center"></i>
                        <span>Ayarlar</span>
                    </a>
                </div>
            </div>
        </nav>

        <div class="p-4 border-t border-white/10 sticky bottom-0 bg-navy-900">
            <div class="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors cursor-pointer">
                <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-bold shadow-inner shrink-0">
                    S
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold text-white truncate">SPRINTYUZMEOKULU</p>
                    <p class="text-[11px] text-white/50 truncate">Kurucu Yönetici</p>
                </div>
                <button class="w-8 h-8 flex items-center justify-center rounded-lg text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Güvenli Çıkış">
                    <i class="fa-solid fa-arrow-right-from-bracket"></i>
                </button>
            </div>
        </div>
    </aside>

    <main class="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50 relative">
        
        <!-- Üst Bar (Topbar) - Mobil -->
        <header class="lg:hidden bg-white/80 backdrop-blur-md border-b border-slate-200 h-16 flex items-center justify-between px-4 sticky top-0 z-30">
            <div class="flex items-center gap-3">
                <button onclick="toggleMenu()" class="w-10 h-10 flex items-center justify-center rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                    <i class="fa-solid fa-bars"></i>
                </button>
                <div class="font-bold text-navy-900 text-lg">SprintOS</div>
            </div>
            
            <button class="flex items-center justify-center gap-2 bg-red-600 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-lg shadow-red-600/30">
                <i class="fa-solid fa-arrow-right-from-bracket"></i> Çıkış
            </button>
        </header>

        <div class="flex-1 overflow-y-auto p-4 lg:p-8 space-y-8">
            
            <div class="hidden lg:flex items-center justify-between mb-8">
                <!-- Global Arama -->
                <div class="relative w-[400px]">
                    <i class="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                    <input type="text" placeholder="Öğrenci, veli veya işlem ara..." class="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all shadow-sm">
                    <div class="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                        <kbd class="px-2 py-1 bg-slate-100 border border-slate-200 rounded-md text-[10px] font-mono text-slate-500 font-bold">⌘ K</kbd>
                    </div>
                </div>

                <div class="flex items-center gap-5">
                    <div class="flex flex-col text-right">
                        <span class="text-sm font-bold text-slate-700">30 Ağustos Pazar</span>
                        <span class="text-xs font-medium text-slate-500">2026</span>
                    </div>
                    <div class="h-8 w-px bg-slate-200"></div>
                    <button class="w-11 h-11 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-500 hover:text-brand-600 hover:border-brand-300 transition-all relative shadow-sm">
                        <i class="fa-regular fa-bell text-lg"></i>
                        <span class="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white shadow-sm"></span>
                    </button>
                </div>
            </div>

            <!-- VERCEL / SUPABASE HATA BANNERI (Güvenli Mod Uyarısı) -->
            <div class="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-4 items-start shadow-sm mb-6 animate-pulse" style="animation-iteration-count: 2;">
                <div class="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0 text-xl shadow-inner">
                    <i class="fa-solid fa-database"></i>
                </div>
                <div class="flex-1">
                    <h3 class="text-red-800 font-bold text-base mb-1">Veritabanı Bağlantı Hatası (Sistem Çevrimdışı)</h3>
                    <p class="text-sm text-red-700/90 leading-relaxed font-medium">Supabase projeniz zaman aşımından dolayı duraklatılmış <span class="bg-red-200 px-1.5 rounded text-red-900">(Paused)</span> olabilir veya Vercel ayarlarınız <span class="bg-red-200 px-1.5 rounded text-red-900">(SUPABASE_SERVICE_ROLE_KEY)</span> eksik. Lütfen veritabanınızı aktif hale getirin. Sayfa çökmelerini engellemek için sistem şu an "Güvenli Modda" çalışıyor.</p>
                </div>
            </div>

            <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-2">
                <div>
                    <p class="text-brand-600 font-extrabold text-[11px] tracking-widest uppercase mb-2 flex items-center gap-2">
                        <i class="fa-solid fa-water"></i> SPRİNT YÜZME OKULU
                    </p>
                    <h2 class="text-3xl font-extrabold text-navy-900 tracking-tight">Hoş geldiniz, Yönetici</h2>
                    <p class="text-slate-500 mt-2 font-medium text-sm">Günlük operasyonunuzu tek ekrandan yönetin.</p>
                </div>
                <div class="flex flex-wrap gap-3">
                    <button class="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors shadow-sm flex items-center gap-2">
                        <i class="fa-regular fa-comment-dots text-brand-500"></i> Hızlı Mesaj
                    </button>
                    <button class="px-5 py-2.5 bg-brand-600 text-white rounded-xl font-bold text-sm hover:bg-brand-700 transition-colors shadow-md shadow-brand-500/20 flex items-center gap-2">
                        <i class="fa-solid fa-plus opacity-70"></i> Yeni Ön Kayıt
                    </button>
                </div>
            </div>

            <!-- İstatistik Kartları Grid (4'lü) -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                
                <div class="glass-card p-5 hover:-translate-y-1 transition-all cursor-pointer group hover:shadow-lg hover:shadow-blue-500/10">
                    <div class="flex justify-between items-start mb-4">
                        <div class="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-sm">
                            <i class="fa-solid fa-child-reaching"></i>
                        </div>
                    </div>
                    <div>
                        <p class="text-sm font-bold text-slate-500 mb-1">Aktif Öğrenci</p>
                        <h3 class="text-3xl font-extrabold text-navy-900 tracking-tight">142</h3>
                        <p class="text-xs font-semibold text-slate-400 mt-2 flex items-center gap-1"><i class="fa-solid fa-location-dot text-[10px]"></i> Tüm şubeler</p>
                    </div>
                </div>

                <div class="glass-card p-5 hover:-translate-y-1 transition-all cursor-pointer group hover:shadow-lg hover:shadow-orange-500/10">
                    <div class="flex justify-between items-start mb-4">
                        <div class="w-12 h-12 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center text-xl group-hover:bg-orange-500 group-hover:text-white transition-colors shadow-sm">
                            <i class="fa-solid fa-file-signature"></i>
                        </div>
                    </div>
                    <div>
                        <p class="text-sm font-bold text-slate-500 mb-1">Bekleyen Ön Kayıt</p>
                        <h3 class="text-3xl font-extrabold text-navy-900 tracking-tight">12</h3>
                        <p class="text-xs font-semibold text-slate-400 mt-2 flex items-center gap-1"><i class="fa-regular fa-clock text-[10px]"></i> Geri dönüş bekliyor</p>
                    </div>
                </div>

                <div class="glass-card p-5 hover:-translate-y-1 transition-all cursor-pointer group hover:shadow-lg hover:shadow-red-500/10">
                    <div class="flex justify-between items-start mb-4">
                        <div class="w-12 h-12 rounded-xl bg-red-50 text-red-500 flex items-center justify-center text-xl group-hover:bg-red-500 group-hover:text-white transition-colors shadow-sm">
                            <i class="fa-regular fa-bell"></i>
                        </div>
                    </div>
                    <div>
                        <p class="text-sm font-bold text-slate-500 mb-1">Açık Uyarı</p>
                        <h3 class="text-3xl font-extrabold text-navy-900 tracking-tight">2</h3>
                        <p class="text-xs font-semibold text-slate-400 mt-2 flex items-center gap-1"><i class="fa-solid fa-triangle-exclamation text-[10px]"></i> İşlem gerektiriyor</p>
                    </div>
                </div>

                <div class="glass-card p-5 hover:-translate-y-1 transition-all cursor-pointer group hover:shadow-lg hover:shadow-purple-500/10">
                    <div class="flex justify-between items-start mb-4">
                        <div class="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-xl group-hover:bg-purple-600 group-hover:text-white transition-colors shadow-sm">
                            <i class="fa-solid fa-wallet"></i>
                        </div>
                    </div>
                    <div>
                        <p class="text-sm font-bold text-slate-500 mb-1">Kasa Onayı</p>
                        <h3 class="text-3xl font-extrabold text-navy-900 tracking-tight">3</h3>
                        <p class="text-xs font-semibold text-slate-400 mt-2 flex items-center gap-1"><i class="fa-solid fa-hand-holding-dollar text-[10px]"></i> Teslim onayı bekliyor</p>
                    </div>
                </div>

            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                
                <div class="lg:col-span-2 space-y-6 lg:space-y-8">
                    
                    <!-- Takvim (Günlük Operasyon) -->
                    <div class="glass-card overflow-hidden flex flex-col h-auto min-h-[350px]">
                        <div class="p-6 border-b border-slate-100 flex items-center justify-between bg-white/40">
                            <div>
                                <p class="text-[10px] font-extrabold text-slate-400 tracking-widest uppercase mb-1">Günlük Operasyon</p>
                                <h3 class="text-xl font-extrabold text-navy-900">Bugünkü Dersler ve Yoklamalar</h3>
                            </div>
                            <button class="text-sm font-bold text-brand-600 hover:text-brand-700 flex items-center gap-2 bg-brand-50 px-4 py-2 rounded-xl transition-colors">
                                Takvimi Aç <i class="fa-solid fa-arrow-right text-xs"></i>
                            </button>
                        </div>
                        <div class="p-8 flex-1 flex flex-col items-center justify-center text-center bg-slate-50/50">
                            <div class="w-20 h-20 bg-white shadow-md border border-slate-100 rounded-2xl flex items-center justify-center text-brand-500 text-3xl mb-5">
                                <i class="fa-regular fa-calendar-days"></i>
                            </div>
                            <h4 class="text-navy-900 font-extrabold text-lg mb-2">Bugünkü program hazırlanıyor</h4>
                            <p class="text-sm font-medium text-slate-500 max-w-sm leading-relaxed mb-6">Bir sonraki adımda bugünün tüm derslerini saat, şube, grup, eğitmen, öğrenci sayısı ve yoklama durumuyla burada canlı göstereceğiz.</p>
                        </div>
                    </div>

                    <div class="glass-card p-6">
                        <div class="mb-6">
                            <p class="text-[10px] font-extrabold text-slate-400 tracking-widest uppercase mb-1">Hızlı Erişim</p>
                            <h3 class="text-xl font-extrabold text-navy-900">Modüllere Tek Tıkla Ulaşın</h3>
                        </div>
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4">
                            <a href="#" class="flex flex-col items-center p-4 rounded-xl border border-slate-200 bg-white hover:border-brand-400 hover:shadow-md hover:shadow-brand-500/10 transition-all group text-center">
                                <div class="w-12 h-12 rounded-full bg-slate-50 text-slate-600 flex items-center justify-center text-xl mb-3 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                                    <i class="fa-solid fa-plus"></i>
                                </div>
                                <span class="text-sm font-bold text-slate-700 group-hover:text-brand-700">Yeni Ön Kayıt</span>
                            </a>
                            <a href="#" class="flex flex-col items-center p-4 rounded-xl border border-slate-200 bg-white hover:border-brand-400 hover:shadow-md hover:shadow-brand-500/10 transition-all group text-center relative">
                                <div class="absolute top-3 right-3 w-6 h-6 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-xs font-extrabold border-2 border-white">12</div>
                                <div class="w-12 h-12 rounded-full bg-slate-50 text-slate-600 flex items-center justify-center text-xl mb-3 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                                    <i class="fa-solid fa-file-signature"></i>
                                </div>
                                <span class="text-sm font-bold text-slate-700 group-hover:text-brand-700">Ön Kayıtlar</span>
                            </a>
                            <a href="#" class="flex flex-col items-center p-4 rounded-xl border border-slate-200 bg-white hover:border-brand-400 hover:shadow-md hover:shadow-brand-500/10 transition-all group text-center">
                                <div class="w-12 h-12 rounded-full bg-slate-50 text-slate-600 flex items-center justify-center text-xl mb-3 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                                    <i class="fa-solid fa-child-reaching"></i>
                                </div>
                                <span class="text-sm font-bold text-slate-700 group-hover:text-brand-700">Öğrenciler</span>
                            </a>
                             <a href="#" class="flex flex-col items-center p-4 rounded-xl border border-slate-200 bg-white hover:border-brand-400 hover:shadow-md hover:shadow-brand-500/10 transition-all group text-center">
                                <div class="w-12 h-12 rounded-full bg-slate-50 text-slate-600 flex items-center justify-center text-xl mb-3 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                                    <i class="fa-solid fa-building"></i>
                                </div>
                                <span class="text-sm font-bold text-slate-700 group-hover:text-brand-700">Şubeler</span>
                            </a>
                        </div>
                    </div>
                </div>

                <div class="space-y-6 lg:space-y-8">
                    
                    <div class="glass-card flex flex-col h-[400px]">
                        <div class="p-5 border-b border-slate-100 flex items-center justify-between bg-white/40">
                            <div>
                                <p class="text-[10px] font-extrabold text-slate-400 tracking-widest uppercase mb-1">Öncelikler</p>
                                <h3 class="text-lg font-extrabold text-navy-900">Akıllı Uyarılar</h3>
                            </div>
                        </div>
                        <div class="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30">
                            
                            <div class="bg-pink-50 border border-pink-200 rounded-xl p-3 flex gap-3 items-start relative group hover:border-pink-300 transition-all cursor-pointer shadow-sm">
                                <div class="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-500 shrink-0 text-lg">
                                    <i class="fa-solid fa-cake-candles"></i>
                                </div>
                                <div class="flex-1 min-w-0 pr-8">
                                    <h4 class="font-bold text-pink-900 text-sm">Ela Su Arslan için doğum günü</h4>
                                    <p class="text-xs font-medium text-pink-700 mt-1">Öğrenci mesajı hazır.</p>
                                </div>
                                <div class="absolute right-3 top-1/2 -translate-y-1/2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                    <div class="w-8 h-8 bg-[#25D366] rounded-full flex items-center justify-center text-white shadow-md">
                                        <i class="fa-brands fa-whatsapp"></i>
                                    </div>
                                </div>
                            </div>

                            <div class="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-3 items-start relative group hover:border-red-300 transition-all cursor-pointer shadow-sm">
                                <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-500 shrink-0 text-lg">
                                    <i class="fa-regular fa-bell"></i>
                                </div>
                                <div class="flex-1 min-w-0 pr-8">
                                    <h4 class="font-bold text-red-900 text-sm">2 açık uyarı bulunuyor</h4>
                                    <p class="text-xs font-medium text-red-700 mt-1">Öncelikli işlemleri kontrol edin.</p>
                                </div>
                                <i class="fa-solid fa-chevron-right absolute right-4 top-1/2 -translate-y-1/2 text-red-300 text-sm group-hover:translate-x-1 transition-transform"></i>
                            </div>

                             <div class="bg-purple-50 border border-purple-200 rounded-xl p-3 flex gap-3 items-start relative group hover:border-purple-300 transition-all cursor-pointer shadow-sm">
                                <div class="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 shrink-0 text-lg">
                                    <i class="fa-solid fa-wallet"></i>
                                </div>
                                <div class="flex-1 min-w-0 pr-8">
                                    <h4 class="font-bold text-purple-900 text-sm">3 kasa işlemi bekliyor</h4>
                                    <p class="text-xs font-medium text-purple-700 mt-1">Teslim ve onay işlemlerini yapın.</p>
                                </div>
                                <i class="fa-solid fa-chevron-right absolute right-4 top-1/2 -translate-y-1/2 text-purple-300 text-sm group-hover:translate-x-1 transition-transform"></i>
                            </div>

                        </div>
                    </div>

                    <div class="glass-card p-6">
                        <div class="mb-5">
                            <h3 class="text-lg font-extrabold text-navy-900">Aktif Lokasyonlar</h3>
                        </div>
                        <div class="space-y-4">
                            <div class="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:border-slate-200 transition-colors shadow-sm">
                                <div class="flex items-center gap-3">
                                    <span class="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse"></span>
                                    <span class="font-bold text-sm text-slate-700">Konyaaltı Öğretmenevi</span>
                                </div>
                            </div>
                            <div class="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:border-slate-200 transition-colors shadow-sm">
                                <div class="flex items-center gap-3">
                                    <span class="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse"></span>
                                    <span class="font-bold text-sm text-slate-700">Meltem Yüzme Havuzu</span>
                                </div>
                            </div>
                             <div class="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:border-slate-200 transition-colors shadow-sm">
                                <div class="flex items-center gap-3">
                                    <span class="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse"></span>
                                    <span class="font-bold text-sm text-slate-700">Süleyman Erol Olimpik</span>
                                </div>
                            </div>
                             <div class="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:border-slate-200 transition-colors shadow-sm">
                                <div class="flex items-center gap-3">
                                    <span class="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse"></span>
                                    <span class="font-bold text-sm text-slate-700">Lara Life City</span>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            <!-- Footer Alt Boşluğu (Mobil için önemli) -->
            <div class="h-12"></div>
        </div>
    </main>

    <script>
        // Mobil menü aç/kapat işlevi
        function toggleMenu() {
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('mobile-overlay');
            
            if (sidebar.classList.contains('-translate-x-full')) {
                // Menüyü Aç
                sidebar.classList.remove('-translate-x-full');
                overlay.classList.remove('hidden');
                // Kısa bir gecikme ile opacity ekle (animasyon için)
                setTimeout(() => {
                    overlay.classList.remove('opacity-0');
                    overlay.classList.add('opacity-100');
                }, 10);
            } else {
                // Menüyü Kapat
                sidebar.classList.add('-translate-x-full');
                overlay.classList.remove('opacity-100');
                overlay.classList.add('opacity-0');
                // Animasyon bitiminde gizle
                setTimeout(() => {
                    overlay.classList.add('hidden');
                }, 300);
            }
        }
    </script>
</body>
</html>
