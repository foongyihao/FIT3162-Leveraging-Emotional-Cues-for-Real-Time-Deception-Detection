import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

export default function AboutPage() {
  return (
    <main className="container mx-auto px-4 py-8 space-y-8 max-w-4xl">
      <header className="text-center space-y-4">
        <h1 className="text-4xl font-bold">About Our Project</h1>
        <p className="text-xl text-muted-foreground">
          Leveraging Emotional Cues for Real-Time Deception Detection
        </p>
      </header>

      <section className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Background Information</CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none">
            <p>
              Deception is a fundamental aspect of human communication and interaction. It occurs in a wide variety of contexts, from personal relationships and professional negotiations to legal proceedings and security scenarios. Accurately detecting deception is crucial for several reasons, including promoting justice, enabling informed decision-making, and maintaining safety and security. Despite its significance, reliably identifying deceptive behaviour remains a difficult and complex task. The subtle and often inconspicuous nature of deceptive actions and expressions makes discerning truth from falsehood a considerable challenge.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Problem – Computational Complexity</CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none">
            <p>
              Recent technological advancements have led to the development of automated systems that detect deception by analysing various emotional cues, including micro-expressions. Many of the most advanced deception detection technologies today employ multimodal approaches, which integrate multiple types of data such as facial expressions, voice analysis, physiological signals (e.g., heart rate, skin conductance), and even brain activity via EEG. These systems often combine micro-expressions with other data streams to improve accuracy and robustness.
            </p>
            <p>
              While multimodal systems can enhance performance, they come with significant challenges. The complexity of processing multiple data types simultaneously increases the computational power required to run these models in real-time. Additionally, the integration of sensors like EEG or physiological monitors makes these systems expensive and difficult to implement in everyday scenarios. The high computational and financial costs associated with multimodal systems can make them impractical for widespread use in real-time applications, such as in courtrooms, interviews, or security systems.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Opportunity – Using Micro-Expressions</CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none">
            <p>
              Micro-expressions, although brief and subtle, can be a powerful tool for detecting deception. When people attempt to deceive others, they often try to conceal their true emotions. However, micro-expressions, which are involuntary and occur in response to emotional stimuli, can reveal the underlying emotions that the deceiver is trying to hide. Despite their potential, humans find it difficult to detect micro-expressions accurately due to their fleeting nature.
            </p>
            <p>
              This is where machines offer a significant advantage. While humans may struggle to perceive these brief emotional cues, machine learning algorithms can identify and analyzing micro-expressions with precision (Monaro et al., 2022). With the help of advanced computational models, machines can process and interpret the nuanced facial expressions that humans may miss. By focusing on micro-expressions as a standalone indicator of deception, we can design a system that is computationally simpler and more cost-effective than existing multimodal approaches, while still delivering accurate results.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Importance of the Project</CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none">
            <p>
              The importance of this project lies in its ability to deliver a practical, real-time solution for detecting deception that is both accessible and affordable. Accurate and timely assessment of truthfulness is crucial in various settings, such as legal trials, interviews, and security screenings. While current high-performing systems are effective, they are often prohibitively expensive or too complex for widespread use. By focusing on micro-expressions and developing a computationally efficient model, this project aims to bridge the gap between advanced deception detection technology and real-world applications. Success in this endeavour could enhance fairness and accuracy in legal proceedings, improve job interview outcomes by identifying truthful candidates, and bolster security protocols in high-risk environments, addressing the growing need for practical and accessible deception detection solutions across diverse sectors.
            </p>

            <div className="my-6">
              <h3 className="text-lg font-semibold mb-2">Problem and Opportunity Summary</h3>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-muted">
                    <th className="border p-2 text-left">Problem</th>
                    <th className="border p-2 text-left">Opportunity</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border p-2">High resource and computational demands</td>
                    <td className="border p-2">Single-modal solution using micro-expressions to achieve a more efficient and accessible real-time detection system</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p>
              This project aims to address the limitations of existing deception detection systems by developing a model that is both real-time and computationally efficient. The objective is to create a solution that balances accuracy with cost-effectiveness, making it more accessible and practical for everyday use. By reducing computational demands and operational costs, this model will improve usability in key areas such as courtrooms, job interviews, and security systems. The goal is to enhance the reliability and availability of deception detection technologies, providing valuable tools for industries that depend on accurate assessments of truthfulness.
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
