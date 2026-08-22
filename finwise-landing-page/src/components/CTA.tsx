const CTA: React.FC = () => {
    return (
        <section id="cta" className="mt-8 mb-4 lg:my-14">
            <div className="mx-auto w-full max-w-6xl px-3 sm:px-5">
                <h2 className="mb-6 text-center text-3xl font-semibold text-foreground md:text-5xl">
                    产品介绍视频
                </h2>
                <video
                    className="block aspect-video w-full rounded-[28px] bg-black object-contain shadow-[0_24px_80px_rgba(15,23,42,0.18)]"
                    src="/videos/sparklearn-demo.mp4"
                    controls
                    preload="metadata"
                    playsInline
                >
                    您的浏览器不支持视频播放。
                </video>
            </div>
        </section>
    )
}

export default CTA
