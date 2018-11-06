import pylab
import numpy
p=1/2
x = numpy.linspace(0,200,1000) # 100 linearly spaced numbers
y = x ** p 


# compose plot
pylab.plot(x,y, label= r'$a=t^ \frac{1}{2}$')

pylab.legend(loc='upper right')
pylab.ylim(0, 5)
pylab.xlim(0, 20)
pylab.ylabel(r'Scale factor $ a $')
pylab.xlabel(r'Time $t$')
pylab.savefig('demo.png', transparent=True)
pylab.show() # show the plot

