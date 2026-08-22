import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { testimonials } from '@/data/testimonials';

const Testimonials: React.FC = () => {
    return (
        <div className="grid gap-6 max-w-lg w-full mx-auto lg:grid-cols-3 lg:max-w-full">
            {testimonials.map((testimonial, index) => (
                <div
                    key={index}
                    className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-transform hover:-translate-y-1 hover:shadow-lg"
                >
                    <div className="flex items-center mb-4 w-full justify-center lg:justify-start">
                        <Image
                            src={testimonial.avatar}
                            alt={`${testimonial.name} avatar`}
                            width={50}
                            height={50}
                            className="rounded-full shadow-md"
                        />
                        <div className="ml-4">
                            <h3 className="text-lg font-semibold text-secondary">{testimonial.name}</h3>
                            <p className="text-sm text-foreground-accent">{testimonial.role}</p>
                        </div>
                    </div>
                    <p className="grow text-foreground-accent text-center lg:text-left">&quot;{testimonial.message}&quot;</p>
                    {testimonial.actionText && testimonial.actionUrl && (
                        <Link
                            href={testimonial.actionUrl}
                            className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-foreground px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-foreground-accent"
                        >
                            {testimonial.actionText}
                        </Link>
                    )}
                </div>
            ))}
        </div>
    );
};

export default Testimonials;
