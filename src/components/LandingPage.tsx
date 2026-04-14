import { motion } from 'framer-motion';
import { ArrowRight, FileText, BarChart3, Presentation } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="p-6 flex justify-between items-center border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-bold text-white tracking-tighter">HIQ</div>
          <span className="text-xl font-bold tracking-tight text-gray-900">HireIQ</span>
        </div>
        <nav className="flex items-center gap-6 text-sm font-medium">
          <a href="#features" className="text-gray-500 hover:text-gray-900 transition-colors">Features</a>
          <a href="#how-it-works" className="text-gray-500 hover:text-gray-900 transition-colors">How it works</a>
          <Link to="/login" className="px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 hover:bg-gray-50 transition-all">Sign In</Link>
          <Link to="/login" className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-all font-semibold">Start Free Trial</Link>
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center pt-24 px-6 text-center bg-gray-50">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl"
        >
          <h1 className="text-6xl md:text-7xl font-bold tracking-tighter text-gray-900 mb-6 leading-tight">
            Clean, professional <br />
            <span className="text-primary">Recruitment Intelligence.</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            Transform your hiring pipeline with AI-driven resume parsing, intelligent 
            candidate scoring, and automated mock interviews that prioritize clarity.
          </p>
          
          <div className="flex items-center justify-center gap-4">
            <Link to="/dashboard" className="group flex items-center gap-2 px-8 py-4 rounded-lg bg-primary text-white hover:bg-primary/90 transition-all text-lg font-semibold shadow-sm">
              Enter Dashboard
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl"
        >
          {[
            { icon: FileText, title: "Intelligent Parsing", desc: "Drag & drop resumes to instantly extract structured candidate profiles using advanced AI." },
            { icon: BarChart3, title: "Weighted Scoring", desc: "Evaluate candidates fairly with customizable scoring dimensions tailored to your job descriptions." },
            { icon: Presentation, title: "Mock Interviews", desc: "Auto-generate role-specific questions and provide candidates a high-end practice environment." }
          ].map((feature, i) => (
            <div key={i} className="p-8 rounded-xl bg-white border border-gray-200 shadow-sm text-left flex flex-col gap-4">
              <div className="w-12 h-12 rounded-lg bg-purple-50 text-primary flex items-center justify-center">
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">{feature.title}</h3>
              <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </motion.div>
      </main>
    </div>
  );
}
