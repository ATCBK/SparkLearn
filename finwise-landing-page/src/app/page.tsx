import Hero from "@/components/Hero";
import Testimonials from "@/components/Testimonials";
import Pricing from "@/components/Pricing/Pricing";
import FAQ from "@/components/FAQ";
import Logos from "@/components/Logos";
import Benefits from "@/components/Benefits/Benefits";
import Container from "@/components/Container";
import Section from "@/components/Section";
import Stats from "@/components/Stats";
import CTA from "@/components/CTA";

const HomePage: React.FC = () => {
  return (
    <>
      <Hero />
      <Logos />
      <Container>
        <CTA />

        <Benefits />

        <Section
          id="pricing"
          title="产品方案"
          description="从个人体验到机构落地，按不同使用场景展示 SparkLearn 的核心能力。"
        >
          <Pricing />
        </Section>

        <Section
          id="cases"
          title="用户反馈"
          description="看一眼就知道，为什么他们会选择 SparkLearn。"
        >
          <Testimonials />
        </Section>

        <FAQ />

        <Stats />
      </Container>
    </>
  );
};

export default HomePage;
